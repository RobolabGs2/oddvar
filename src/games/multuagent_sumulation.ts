import { Matrix, Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { TailEntity } from "../oddvar/world"
import { RectangleBody } from '../oddvar/physics/body';
import { ColoredTexture, RectangleTexture } from '../oddvar/textures';
import { RaySensor } from '../oddvar/physics/sensor';
import { CollectingSquaresGame, MapCreator, PacMan, PacManLikeLabirint, RandomLabirint } from './collecting_squares';
import { Labirint } from './labirint';
import { Iterators } from '../oddvar/iterator';
import { PrettyPrint } from '../oddvar/debug';


function toLabirintCoords(cellSize: Size, p: Point): Point {
	return new Point((p.x / cellSize.width) | 0, (p.y / cellSize.height) | 0);
}

function fromCoords(cellSize: Size, p: Point): Point {
	return new Point((p.x + 0.5) * cellSize.width, (p.y + 0.5) * cellSize.height);
}

export class MultiagentSimulation extends CollectingSquaresGame {
	map: Labirint = PacMan;
	bots: Bot[]
	constructor(oddvar: Oddvar, mapCreator: MapCreator = RandomLabirint, readonly debug = false) {
		super(oddvar, PacManLikeLabirint, debug)
		this.bots = Iterators.Range(10).map(i => new Bot(this.oddvar, this.GenerateInconflictPoint(14), new Size(this.size.width, this.size.height), this.botTextures[i % this.botTextures.length], PacMan, new Size(25, 25))).toArray();
		this.onRelocate = () => this.bots.forEach(bot => bot.setTarget(this.targetPoint.location));
		this.onRelocate();
		this.targetBody.AddCollisionListener((self, b) => { if (this.bots.find(bot => bot.body == b)) this.RelocatePoint() })
	}

	Tick(dt: number): void {
		this.bots.forEach(bot => bot.Tick(dt));
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
	sensors: BotSensors
	sensorsBinding: TailEntity
	program?: Generator<Dir, void, boolean>;
	lastCommand?: { dir: Dir, dest: Point };
	constructor(readonly oddvar: Oddvar, place: Point, readonly size: Size, botTexture: RectangleTexture, readonly map: Labirint, readonly cellSize: Size, debug = false) {
		const name = (type: string) => `bot: ${type}`;
		this.size.width = size.width / 5 * 4;
		this.size.height = size.height / 5 * 4;
		const sensorsSettings: SensorsSettings = {
			Center: 0,
			Left: -Math.PI / 3,
			Right: Math.PI / 3,
		}

		const e = this.oddvar.Get("World").CreateEntity(name("entity"), place);
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture("bot", { stroke: "red", fill: "red" });
		this.sensorsBinding = this.oddvar.Get("World").CreateTailEntity(name("ray entity"), e, new Point(this.size.width / 2 - 1, 0));
		this.body = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size);
		this.sensors = ConvertRecord(sensorsSettings,
			(key, rotation) => this.makeSensor((x) => name(`${key} ray ${x}`), texture, rotation, debug)) as BotSensors;
		if (debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body debug avatar"), this.body, texture);
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body avatar"), this.body, botTexture);

		this.prevState = {
			location: place.Clone(),
			rotation: 0
		}

	}

	nextPoint() {
		const next = this.program?.next();
		if (next === undefined || next.done) {
			this.lastCommand = undefined;
			return;
		}
		const current = toLabirintCoords(this.cellSize, this.location);
		this.lastCommand = {
			dir: next.value,
			dest: fromCoords(this.cellSize, movePoint(next.value, current))
		}
	}

	setTarget(point: Point) {
		this.program = MoveToProgram(this.map, toLabirintCoords(this.cellSize, this.body.entity.location), toLabirintCoords(this.cellSize, point));
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
		if (this.lastCommand === undefined)
			return;
		const delta = this.lastCommand.dest.Sub(this.location);
		if (delta.Len() > 10) {
			this.body.Kick(delta.Mult(20000))
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

enum Dir { UP, DOWN, LEFT, RIGHT }

function ReverseDir(d: Dir): Dir {
	switch (d) {
		case Dir.UP: return Dir.DOWN;
		case Dir.DOWN: return Dir.UP;
		case Dir.LEFT: return Dir.RIGHT;
		case Dir.RIGHT: return Dir.LEFT;
	}
	throw new TypeError(`Unknown Dir: ${d}`);
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

function* MoveToProgram(map: Labirint, start: Point, end: Point): Generator<Dir, void, boolean> {
	const from = new Array<Dir[]>(map.height);
	for (let i = 0; i < map.height; i++)
		from[i] = new Array(map.width).fill(-1);
	const queue = [start];
	start = start.Clone();
	const startPoint = 9;
	from[start.y][start.x] = startPoint;
	while (queue.length) {
		const v = queue.shift()!;
		if (isFinish(v)) {
			const answer = new Array<Dir>();
			for (let to = v; true;) {
				const dir = from[to.y][to.x];
				if (dir === startPoint)
					break;
				answer.push(dir);
				movePoint(ReverseDir(dir), to)
			}
			console.log(PrettyPrint.matrix(from, (d) => {
				switch (d) {
					case startPoint:
						return "S";
					case -1:
						return "_";
					default:
						return Dir[d].substr(0, 1);
				}
			}));
			for (let d of answer.reverse()) {
				yield d;
			}	
			return;
		}

		[Dir.UP, Dir.DOWN, Dir.LEFT, Dir.RIGHT].forEach((dir) => {
			const next = movePoint(dir, v.Clone());
			if (from[next.y][next.x] !== -1 || map.get(next.x, next.y) !== false)
				return;
			from[next.y][next.x] = dir;
			queue.push(next);
		})
	}

	function isFinish(v: Point) {
		return v.x === end.x && v.y === end.y;
	}
	throw new Error(`Can't find path from ${JSON.stringify(start)} to ${JSON.stringify(end)}`)
}

function movePoint(p: Dir, s: Point): Point {
	switch (p) {
		case Dir.UP: s.y--; break;
		case Dir.DOWN: s.y++; break;
		case Dir.LEFT: s.x--; break;
		case Dir.RIGHT: s.x++; break;
	}
	return s;
}

