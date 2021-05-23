import { Matrix, Point } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar";
import { PolygonBody } from '../../oddvar/physics/body';
import { RaySensor } from '../../oddvar/physics/sensor';
import { ColoredTexture } from '../../oddvar/textures';
import { Entity, TailEntity } from '../../oddvar/world';
import { GameMap } from "../utils/game_map";
import { DataMatrix, Dir, MatrixCell } from '../../oddvar/labirint/labirint';
import { Message, MessageDataMap, NetworkCard } from './net';
import { Observable } from '../../oddvar/utils';

export interface Evaluator {
	// Можно ли доверять сообщению
	Evaluate(bot: Bot, msg: Message): boolean
}


export interface SendMiddleware {
	Send<T extends keyof MessageDataMap>(bot: Bot, to: string, type: T, data: MessageDataMap[T]): void;
}

export class Bot extends Observable<{ mapUpdated: BotMap }>{
	program?: Dir[];
	lastCommand?: { dir: Dir; dest: Point; };
	map: BotMap;
	mapUpdated = true;
	constructor(readonly name: string,
		oddvar: Oddvar,
		readonly body: PolygonBody,
		readonly color: ColoredTexture,
		map: GameMap,
		readonly layer: number,
		readonly network: NetworkCard,
		readonly evaluator: Evaluator,
		readonly sender: SendMiddleware,
		readonly debug = false) {
		super();
		const nameOf = (type: string) => `bot ${layer}: ${type}`;
		this.map = new BotMap(map, -1);
		this.destinationE = oddvar.Get("World").CreateEntity(nameOf("destination entity"), Point.Zero);
		this.destinationE.rotation = Math.PI / 4;
		this.nextE = oddvar.Get("World").CreateEntity(nameOf("next entity"), Point.Zero);
		if (debug) {
			oddvar.Get("Graphics").CreateRectangleEntityAvatar(nameOf("destination avatar"), this.destinationE, map.cellSize.Scale(0.25), this.color);
			oddvar.Get("Graphics").CreateCircleEntityAvatar(nameOf("next avatar"), this.nextE, 2, this.color);
		}

	}
	destinationE: Entity;
	nextE: Entity;
	nextPoint() {
		this.time = 0;
		const next = this.program?.shift();
		if (next === undefined || this.map.destination === undefined) {
			this.lastCommand = undefined;
			return;
		}
		const current = this.map.toMazeCoords(this.location);
		this.lastCommand = {
			dir: next,
			dest: Dir.shiftPoint(next, this.map.fromMazeCoords(Dir.movePoint(next, current)), this.map.cellSize.width / 4)
		};
		this.nextE.location = this.lastCommand.dest;
	}

	resetMap() {
		this.map = new BotMap(this.map, this.network.clock.now());
		this.map.onupdate = (map) => { this.mapUpdated = true; }
		this.network.broadcast("captured", true);
	}

	nextPath() {
		this.program = this.map.nextPath(this.location);
		this.nextPoint();
		this.destinationE.location = this.map.destination ? this.map.fromMazeCoords(this.map.destination) : Point.Zero;
	}

	Move(direction: Dir) {
		this.body.Kick(new Point(100000, 0).Transform(Matrix.Rotation(Dir.Angle(direction))));
		//this.body.entity.rotation - (direction == "backward" ? Math.PI : 0))))
	}


	Turn(direction: "right" | "left") {
		this.body.TurnKick((direction == "left" ? -1 : 1) * 300000);
	}

	public get location(): Point {
		return this.body.entity.location;
	}

	time: number = 0;
	kickTo?: Point
	TickBody(dt: number) {
		if (this.kickTo) {
			const delta = this.kickTo.Sub(this.location);
			this.body.Kick(delta.Norm().Mult(this.body.Area() * 500 * 2));
		}
	}
	anotherStates = new Map<string, boolean>();
	Tick(dt: number, visible: MatrixCell<Map<string, Point>>[]) {
		this.network.readAll({
			"target": (msg) => {
				if (this.map.target !== undefined || msg.timestamp < this.map.createdAt || !this.evaluator.Evaluate(this, msg))
					return;
				const l = this.map.toMazeCoords(msg.data)
				this.map.update(l.x, l.y, msg.data)
			},
			"captured": (msg) => {
				if (this.evaluator.Evaluate(this, msg))
					this.anotherStates.set(msg.from, false);
			},
			"empty": (msg) => {
				if (this.map.target !== undefined || msg.timestamp < this.map.createdAt || !this.evaluator.Evaluate(this, msg))
					return;
				const l = this.map.toMazeCoords(msg.data)
				this.map.update(l.x, l.y, null)
			}
		});
		visible.forEach(cell => {
			let updated = false;
			cell.value.forEach((point, owner) => {
				if (owner === this.name) {
					this.map.update(cell.point.x, cell.point.y, point)
					updated = true;
				} else {
					if (!this.anotherStates.get(owner)) {
						// this.network.send(owner, "target", point);
						this.sender.Send(this, owner, "target", point);
						this.anotherStates.set(owner, true);
					}
				}
			});
			if (!updated && this.map.update(cell.point.x, cell.point.y, null)) {
				// this.network.broadcast("empty", this.map.fromMazeCoords(cell.point));
			}
		})
		this.time += dt;
		if (this.mapUpdated) {
			this.mapUpdated = false;
			this.dispatchEvent("mapUpdated", this.map);
		}
		if (this.lastCommand === undefined) {
			this.nextPath();
			return;
		}
		const delta = this.lastCommand.dest.Sub(this.location);
		if (delta.Len() > Math.sqrt(this.body.Area()) / 2) {
			if (this.time > 20) {
				// попали в тупик
				this.nextPath();
				return;
			}
			this.kickTo = this.lastCommand.dest;
			return;
		}
		this.nextPoint();
	}
}

function pointEquals(p: Point | undefined, x: number, y: number): boolean {
	return p !== undefined && p.x === x && p.y === y;
}

function pointsEqual(p: Point | undefined, p2: Point | undefined): boolean {
	return p !== undefined && p2 !== undefined && p.x === p2.x && p.y === p2.y;
}

export class BotMap extends GameMap {
	explored: DataMatrix<undefined | null | Point>
	merged: DataMatrix<undefined | null | Point | boolean>
	// in maze coords
	target?: Point;
	destination?: Point;
	constructor(gameMap: GameMap, readonly createdAt: number) {
		super(gameMap.maze, gameMap.size);
		this.explored = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
		this.merged = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
	}
	onupdate?: (map: this, x: number, y: number, data: null | Point) => void
	update(x: number, y: number, data: null | Point): boolean {
		if (data === null && pointEquals(this.target, x, y))
			this.target = undefined;
		if (this.explored.get(x, y) !== data) {
			if (!pointsEqual(this.destination, this.target) && pointEquals(this.destination, x, y)) {
				this.destination = undefined;
			}
			this.explored.set(x, y, data);
			if (data !== null)
				this.target = this.toMazeCoords(data);
			this.onupdate?.(this, x, y, data);
			return true;
		}
		return false;
	}
	isExplored(p: Point): boolean{
		const {x, y} = this.toMazeCoords(p);
		return this.explored.get(x, y) === undefined;
	}
	nextPath(from: Point): Dir[] | undefined {
		from = this.toMazeCoords(from);
		if (this.target) {
			this.destination = this.target;
			return this.maze.FindPath(from, this.target);
		}
		const path = this.maze.FindPathAStar(from, (p) => {
			if (this.explored.get(p.x, p.y) === undefined)
				return 0;
			return this.maze.width + this.maze.height - from.Manhattan(p);
		});
		this.destination = path?.reduce((p, d) => Dir.movePoint(d, p), from);
		return path;
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

function* BotProgram(sensors: BotSensors): Generator<BotCommand<keyof BotCommandsMap>, void, boolean> {
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

type BotSensor = {
	entity: TailEntity,
	ray: RaySensor
}

type BotSensors = {
	Center: BotSensor
	Left: BotSensor
	Right: BotSensor
}

type Settings<T, S> = { [K in keyof T]: S }
type SensorsSettings = Settings<BotSensors, number>
