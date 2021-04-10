import { Matrix, Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { TailEntity } from "../oddvar/world"
import { RectangleBody } from '../oddvar/physics/body';
import { ColoredTexture, RectangleTexture } from '../oddvar/textures';
import { RaySensor } from '../oddvar/physics/sensor';
import { GameMap, Target, WallManager } from './collecting_squares';
import { DataMatrix, Dir } from './labirint';
import { Iterators } from '../oddvar/iterator';
import { GameLogic } from '../oddvar/manager';

export class MultiagentSimulation implements GameLogic {
	bots: Bot[]
	wallManager = new WallManager(this.oddvar);
	private targetMap: DataMatrix<boolean | Map<string, Point>>
	constructor(readonly oddvar: Oddvar, private map: GameMap, readonly debug = false) {
		console.log(this.map.maze.toString())
		map.Draw(this.wallManager.creator)
		this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
		const botsCount = 10;
		this.bots = Iterators.Range(botsCount).
			map(i => new Bot(this.oddvar, this.GenerateInconflictPoint(10, 1 << i), this.map.cellSize.Scale(2 / 6),
				this.getTexture(i), this.map, this.map.cellSize, i)).toArray();
		const targetSize = this.map.cellSize.Scale(1 / 5);
		const targetName = (i: number, name: string) => `target_${i} ${name}`
		this.bots.forEach((bot, i) => {
			const layers = 1 << i;
			const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), this.GenerateInconflictPoint(targetSize.width, layers));
			const targetBody = oddvar.Get("Physics").CreateRectangleBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize);
			oddvar.Get("Graphics").CreateRectangleBodyAvatar(targetName(i, "avatar"), targetBody, this.getTexture(i));
			const target = new Target<number>(targetBody);
			target.addEventListener("relocate", (p) => {
				const old = this.map.toMazeCoords(p.from);
				const now = this.map.toMazeCoords(p.to);
				(<Map<string, Point>>this.targetMap.get(old.x, old.y)).delete(bot.body.Name);
				(<Map<string, Point>>this.targetMap.get(now.x, now.y)).set(bot.body.Name, p.to);
				bot.resetMap();
			});
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
		this.bots.forEach(bot => {
			const l = bot.botMap.toMazeCoords(bot.location);
			this.targetMap.BFS(l, 2, true).forEach(p => {
				const target = (<Map<string, Point>>p.value).get(bot.body.Name);
				if (target) {
					bot.botMap.update(p.point.x, p.point.y, target);
				} else
					bot.botMap.update(p.point.x, p.point.y, null)
			})
			bot.Tick(dt)
		});
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



class BotMap extends GameMap {
	explored: DataMatrix<undefined | null | Point>
	merged: DataMatrix<undefined | null | Point | boolean>
	target?: Point;
	constructor(gameMap: GameMap) {
		super(gameMap.maze, gameMap.size);
		this.explored = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
		this.merged = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
	}
	update(x: number, y: number, data: null | Point) {
		if (data !== null)
			this.target = this.toMazeCoords(data);
		this.explored.set(x, y, data);
	}
	nextPath(from: Point): Dir[] | undefined {
		from = this.toMazeCoords(from);
		if (this.target) {
			return this.maze.FindPath(from, this.target);
		}
		return this.maze.FindPathAStar(from, (p) => {
			if (this.explored.get(p.x, p.y) === undefined)
				return 0;
			return 1;//this.maze.width + this.maze.height - from.Manhattan(p);
		});
	}
	toString() {
		return this.maze.MergeOr(this.explored, this.merged).toString(x => {
			if (x === undefined)
				return "?";
			if (x === true)
				return "#";
			if (x === null)
				return ".";
			return "T";
		})
	}
}

class Bot {
	body: RectangleBody
	program?: Dir[];
	lastCommand?: { dir: Dir, dest: Point };
	botMap: BotMap
	constructor(readonly oddvar: Oddvar, place: Point, readonly size: Size, botTexture: RectangleTexture, readonly map: GameMap, readonly cellSize: Size, readonly layer: number, debug = false) {
		const name = (type: string) => `bot ${layer}: ${type}`;
		this.botMap = new BotMap(map);
		const e = this.oddvar.Get("World").CreateEntity(name("entity"), place);
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture("bot", { stroke: "red", fill: "red" });
		this.body = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1, layers: 1 << layer }, this.size);
		if (debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body debug avatar"), this.body, texture);
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body avatar"), this.body, botTexture);
	}

	nextPoint() {
		this.time = 0;
		const next = this.program?.shift();
		if (next === undefined) {
			this.lastCommand = undefined;
			return;
		}
		const current = this.map.toMazeCoords(this.location);
		this.lastCommand = {
			dir: next,
			dest: shifPoint(next, this.map.fromMazeCoords(movePoint(next, current)), this.cellSize.width / 4)
		}
	}

	resetMap() {
		this.botMap = new BotMap(this.map);
	}

	nextPath() {
		this.program = this.botMap.nextPath(this.location);
		this.nextPoint();
		if (this.program && this.layer === 1)
			console.log(this.botMap.toString());
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

	Tick(dt: number) {
		this.time += dt;
		if (this.lastCommand === undefined) {
			this.nextPath();
			return;
		}
		const delta = this.lastCommand.dest.Sub(this.location);
		if (delta.Len() > this.body.size.width / 2) {
			if (this.time > 20) {
				// попали в тупик
				this.nextPath();
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