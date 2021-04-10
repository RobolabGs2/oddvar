import { Matrix, Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar";
import { RectangleBody } from '../../oddvar/physics/body';
import { RaySensor } from '../../oddvar/physics/sensor';
import { ColoredTexture, RectangleTexture } from '../../oddvar/textures';
import { TailEntity } from '../../oddvar/world';
import { GameMap } from '../collecting_squares/collecting_squares';
import { DataMatrix, Dir, MatrixCell } from '../../oddvar/labirint/labirint';
import { NetworkCard } from './net';

export class Bot {
	body: RectangleBody;
	program?: Dir[];
	lastCommand?: { dir: Dir; dest: Point; };
	botMap: BotMap;
	color: ColoredTexture;
	constructor(
		readonly name: string,
		oddvar: Oddvar,
		place: Point, readonly size: Size, botTexture: RectangleTexture,
		readonly map: GameMap,
		readonly layer: number,
		readonly network: NetworkCard,
		readonly debug = false) {
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		this.color = oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { stroke: currentColor, strokeWidth: 2});
		const nameOf = (type: string) => `bot ${layer}: ${type}`;
		this.botMap = new BotMap(map);
		const e = oddvar.Get("World").CreateEntity(nameOf("entity"), place);
		this.body = oddvar.Get("Physics").CreateRectangleBody(nameOf("body"), e, { lineFriction: 0.1, angleFriction: 0.1, layers: 1 << layer }, this.size);
		oddvar.Get("Graphics").CreateRectangleBodyAvatar(nameOf("body avatar"), this.body, botTexture);
		oddvar.Get("Graphics").CreateCircleEntityAvatar(nameOf("circle avatar"), e, size.width*0.9, this.color);
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
			dest: shifPoint(next, this.map.fromMazeCoords(movePoint(next, current)), this.map.cellSize.width / 4)
		};
	}

	resetMap() {
		this.botMap = new BotMap(this.map);
	}

	nextPath() {
		this.program = this.botMap.nextPath(this.location);
		this.nextPoint();
		if (this.debug && this.program && this.layer === 0)
			console.log(this.botMap.toString());
	}

	Move(direction: Dir) {
		this.body.Kick(new Point(90000, 0).Transform(Matrix.Rotation(AngleDir(direction))));
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
			this.body.Kick(delta.Norm().Mult(this.body.size.Area() * 500));
		}
	}

	Tick(dt: number, visible: MatrixCell<Map<string, Point>>[]) {
		this.network.readAll({
			"target": (point) => {
				if (this.botMap.target !== undefined)
					return;
				const l = this.botMap.toMazeCoords(point)
				this.botMap.update(l.x, l.y, point);
			}
		});
		visible.forEach(cell => {
			let updated = false;
			cell.value.forEach((point, owner) => {
				if (owner === this.name) {
					this.botMap.update(cell.point.x, cell.point.y, point);
					updated = true;
				} else {
					this.network.send(owner, "target", point);
				}
			});
			if (!updated) this.botMap.update(cell.point.x, cell.point.y, null)
		})
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
			this.kickTo = this.lastCommand.dest;
			return;
		}
		this.nextPoint();
	}
}



export class BotMap extends GameMap {
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
		else if (this.target !== undefined && this.target.x === x && this.target.y === y)
			this.target = undefined;
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

export function AngleDir(d: Dir): number {
	switch (d) {
		case Dir.UP: return Math.PI * 1.5;
		case Dir.DOWN: return Math.PI * 0.5;
		case Dir.LEFT: return Math.PI;
		case Dir.RIGHT: return 0;
	}
	throw new TypeError(`Unknown Dir: ${d}`);
}

export function movePoint(p: Dir, s: Point, count: number = 1): Point {
	switch (p) {
		case Dir.UP: s.y -= count; break;
		case Dir.DOWN: s.y += count; break;
		case Dir.LEFT: s.x -= count; break;
		case Dir.RIGHT: s.x += count; break;
	}
	return s;
}

export function shifPoint(p: Dir, s: Point, count: number = 1): Point {
	switch (p) {
		case Dir.UP: s.x += count; break;
		case Dir.DOWN: s.x -= count; break;
		case Dir.LEFT: s.y += count; break;
		case Dir.RIGHT: s.y -= count; break;
	}
	return s;
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

function ConvertRecord<T1, T2>(a: Record<string, T1>, mapper: (key: string, origin: T1) => T2): Record<string, T2> {
	return Object.fromEntries(Object.entries(a).map(([k, f]) => [k, mapper(k, f)]));
}
