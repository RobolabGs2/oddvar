import { Matrix, Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { TailEntity } from "../oddvar/world"
import { RectangleBody } from '../oddvar/physics/body';
import { ColoredTexture, RectangleTexture } from '../oddvar/textures';
import { RaySensor } from '../oddvar/physics/sensor';
import { GameMap, Target, WallManager } from './collecting_squares';
import { Dir, Labirint } from './labirint';
import { Iterators } from '../oddvar/iterator';
import { GameLogic } from '../oddvar/manager';


function toLabirintCoords(cellSize: Size, p: Point): Point {
	return new Point((p.x / cellSize.width) | 0, (p.y / cellSize.height) | 0);
}

function fromCoords(cellSize: Size, p: Point): Point {
	return new Point((p.x + 0.5) * cellSize.width, (p.y + 0.5) * cellSize.height);
}

export class MultiagentSimulation implements GameLogic {
	bots: Bot[]
	wallManager = new WallManager(this.oddvar);
	constructor(readonly oddvar: Oddvar, private map: GameMap, readonly debug = false) {
		console.log(this.map.maze.toString())
		map.Draw(this.wallManager.creator)
		const botsCount = 10;
		this.bots = Iterators.Range(botsCount).
			map(i => new Bot(this.oddvar, this.GenerateInconflictPoint(10, 1 << i), this.map.cellSize.Scale(2 / 6),
				this.getTexture(i), this.map.maze, this.map.cellSize, i)).toArray();
		const targetSize = this.map.cellSize.Scale(1 / 5);
		const targetName = (i: number, name: string) => `target_${i} ${name}`
		this.bots.forEach((bot, i) => {
			const layers = 1 << i;
			const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), Point.Zero);
			const targetBody = oddvar.Get("Physics").CreateRectangleBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0, layers }, targetSize);
			oddvar.Get("Graphics").CreateRectangleBodyAvatar(targetName(i, "avatar"), targetBody, this.getTexture(i));
			const target = new Target<number>(targetBody);
			target.addEventListener("relocate", (p) => bot.setTarget(p));
			target.addEventListener("collision", () => {
				const newLocation = this.GenerateInconflictPoint(targetSize.width, layers);
				target.relocate(newLocation)
			});
			target.players.set(bot.body, i);
			target.relocate(this.GenerateInconflictPoint(targetSize.width, layers));
		})
	}

	private getTexture(i: number): RectangleTexture {
		return this.botTextures[i % this.botTextures.length];
	}

	Tick(dt: number): void {
		this.bots.forEach(bot => bot.Tick(dt));
	}

	protected GenerateInconflictPoint(distance: number, layers: number = -1): Point {
		let p = new Point((Math.random() * this.map.maze.width) | 0, (Math.random() * this.map.maze.height) | 0);
		if (this.map.maze.get(p.x, p.y) || this.oddvar.Get("Physics").Map(this.map.fromMazeCoords(p), layers) < distance)
			return this.GenerateInconflictPoint(distance, layers);
		return this.map.fromMazeCoords(p);
	}

	AddUser() { }
	private botTextures = Iterators.Range(2).map(i => this.oddvar.Get("TexturesManager").CreateImageTexture(`bot_${0}`, `monster_${i + 1}`)).toArray();

}

type BotSensor = {
	entity: TailEntity,
	ray: RaySensor
}

type BotSensors = {
	Center: BotSensor
	Left: BotSensor
	Right: BotSensor
}

type Settings<T> = { [K in keyof T]: number }
type SensorsSettings = Settings<BotSensors>

function ConvertRecord<T1, T2>(a: Record<string, T1>, mapper: (key: string, origin: T1) => T2): Record<string, T2> {
	return Object.fromEntries(Object.entries(a).map(([k, f]) => [k, mapper(k, f)]));
}

class Bot {
	body: RectangleBody
	// sensors: BotSensors
	sensorsBinding: TailEntity
	program?: Dir[];
	lastCommand?: { dir: Dir, dest: Point };
	target?: Point;
	constructor(readonly oddvar: Oddvar, place: Point, readonly size: Size, botTexture: RectangleTexture, readonly map: Labirint, readonly cellSize: Size, layer: number, debug = false) {
		const name = (type: string) => `bot: ${type}`;
		const sensorsSettings: SensorsSettings = {
			Center: 0,
			Left: -Math.PI / 3,
			Right: Math.PI / 3,
		}

		const e = this.oddvar.Get("World").CreateEntity(name("entity"), place);
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture("bot", { stroke: "red", fill: "red" });
		this.sensorsBinding = this.oddvar.Get("World").CreateTailEntity(name("ray entity"), e, new Point(this.size.width / 2 - 1, 0));
		this.body = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1, layers: 1 << layer }, this.size);
		// this.sensors = ConvertRecord(sensorsSettings,
		// (key, rotation) => this.makeSensor((x) => name(`${key} ray ${x}`), texture, rotation, debug)) as BotSensors;
		if (debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body debug avatar"), this.body, texture);
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body avatar"), this.body, botTexture);

		this.prevState = {
			location: place.Clone(),
			rotation: 0
		}

	}

	nextPoint() {
		this.time = 0;
		const next = this.program?.shift();
		if (next === undefined) {
			this.lastCommand = this.target ? { dir: Dir.DOWN, dest: this.target } : undefined;
			return;
		}
		const current = toLabirintCoords(this.cellSize, this.location);
		this.lastCommand = {
			dir: next,
			dest: shifPoint(next, fromCoords(this.cellSize, movePoint(next, current)), this.cellSize.width / 4)
		}
	}

	setTarget(point: Point) {
		this.program = this.map.FindPathAStar(
			toLabirintCoords(this.cellSize, this.body.entity.location),
			toLabirintCoords(this.cellSize, this.target = point));
		this.nextPoint();
	}

	private makeSensor(name: (type: string) => string, texture: ColoredTexture, rotation: number, debug: boolean): BotSensor {
		const entity = this.oddvar.Get("World").CreateTailEntity(name(`entity`), this.sensorsBinding, new Point(0, 0), rotation)
		const ray = this.oddvar.Get("Physics").CreateRaySensor(name(`sensor`), entity);
		ray.AddToIgnore(this.body);
		if (debug) this.oddvar.Get("Graphics").CreateRaySensorAvatar(name(`avatar`), ray, texture);
		return { entity, ray };
	}

	Move(direction: Dir) {
		this.body.Kick(new Point(90000, 0).Transform(Matrix.Rotation(AngleDir(direction))));
		//this.body.entity.rotation - (direction == "backward" ? Math.PI : 0))))
	}


	Turn(direction: "right" | "left") {
		this.body.TurnKick((direction == "left" ? -1 : 1) * 300000)
	}

	public get location(): Point {
		return this.body.entity.location;
	}

	time: number = 0
	prevState: { location: Point, rotation: number }
	updateState() {
		this.prevState.location = this.body.entity.location.Clone();
		this.prevState.rotation = this.body.entity.rotation;
		this.time = 0;
	}
	Tick(dt: number) {
		this.time += dt;
		if (this.lastCommand === undefined) {
			return;
		}
		const delta = this.lastCommand.dest.Sub(this.location);
		if (delta.Len() > this.body.size.width / 2) {
			if (this.time > 20) {
				this.setTarget(this.target!);
				return;
			}
			this.body.Kick(delta.Norm().Mult(this.body.size.Area() * 500))
			return;
		}
		this.nextPoint();
	}
}

interface BotCommandsMap {
	move: {
		direction: "forward" | "backward"
		distance: number
	}
	turn: {
		direction: "left" | "right"
		angle: number
	}
}

type BotCommand<T extends keyof BotCommandsMap> = {
	command: T
	arguments: BotCommandsMap[T]
	timeout: number
}

function* BotProgram(sensors: BotSensors): Generator<BotCommand<"move"> | BotCommand<"turn">, void, boolean> {
	while (true) {
		const forwardSpace = sensors.Center.ray.distance;
		if (forwardSpace > 5) {
			let forward = yield {
				command: "move",
				timeout: 1.5,
				arguments: {
					direction: "forward",
					distance: forwardSpace,
				}
			};
			continue;
		}

		let rotateLeft = yield {
			command: "turn",
			timeout: 3,
			arguments: {
				direction: "left",
				angle: Math.PI / 4,
			}
		}
		if (rotateLeft)
			continue;
		let rotateRight = yield {
			command: "turn",
			timeout: 3,
			arguments: {
				direction: "right",
				angle: Math.PI / 4,
			}
		}
		if (rotateRight)
			continue;
		yield {
			command: "move",
			timeout: 2,
			arguments: {
				direction: "backward",
				distance: 40,
			}
		}
	}
}

function AngleDir(d: Dir): number {
	switch (d) {
		case Dir.UP: return Math.PI * 1.5;
		case Dir.DOWN: return Math.PI * 0.5;
		case Dir.LEFT: return Math.PI;
		case Dir.RIGHT: return 0;
	}
	throw new TypeError(`Unknown Dir: ${d}`);
}

function movePoint(p: Dir, s: Point, count: number = 1): Point {
	switch (p) {
		case Dir.UP: s.y -= count; break;
		case Dir.DOWN: s.y += count; break;
		case Dir.LEFT: s.x -= count; break;
		case Dir.RIGHT: s.x += count; break;
	}
	return s;
}

function shifPoint(p: Dir, s: Point, count: number = 1): Point {
	switch (p) {
		case Dir.UP: s.x += count; break;
		case Dir.DOWN: s.x -= count; break;
		case Dir.LEFT: s.y += count; break;
		case Dir.RIGHT: s.y -= count; break;
	}
	return s;
}