import { Point } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar";
import { PolygonBody } from '../../oddvar/physics/body';
import { ColoredTexture } from '../../oddvar/textures';
import { Entity } from '../../oddvar/world';
import { GameMap } from "../utils/game_map";
import { Dir, MatrixCell } from '../../oddvar/labirint/labirint';
import { Message, NetworkCard } from './net';
import { Observable } from '../../oddvar/utils';
import { BotMap } from './bot_map';

export interface Evaluator {
	// Можно ли доверять сообщению
	Evaluate(bot: Bot, msg: Message): boolean
}

export abstract class Bot extends Observable<{ mapUpdated: BotMap, captured: { old: BotMap, newMap: BotMap, where: Point } }>{
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
		readonly debug = false) {
		super();
		const nameOf = (type: string) => `bot ${name}: ${type}`;
		this.map = new BotMap(map, -1);
		this.destinationE = oddvar.Get("World").CreateEntity(nameOf("destination entity"), Point.Zero);
		this.destinationE.rotation = Math.PI / 4;
		this.nextE = oddvar.Get("World").CreateEntity(nameOf("next entity"), Point.Zero);
		if (debug) {
			oddvar.Get("Graphics").CreateRectangleEntityAvatar(nameOf("destination avatar"), this.destinationE, map.cellSize.Scale(0.25), this.color);
			oddvar.Get("Graphics").CreateCircleEntityAvatar(nameOf("next avatar"), this.nextE, 2, this.color);
		}
	}
	private destinationE: Entity;
	private nextE: Entity;
	private nextPoint() {
		this.time = 0;
		const next = this.program?.shift();
		if (next === undefined || this.map.destination === undefined) {
			this.lastCommand = undefined;
			return;
		}
		const current = this.map.toMazeCoords(this.location);
		this.lastCommand = {
			dir: next,
			dest:
				// Dir.shiftPoint(next, 
				this.map.fromMazeCoords(Dir.movePoint(next, current))
			// , this.map.cellSize.width / 4)
		};
		this.nextE.location = this.lastCommand.dest;
	}

	captured(where: Point) {
		const old = this.map;
		this.map = new BotMap(this.map, this.network.clock.now());
		this.dispatchEvent("captured", { old, newMap: this.map, where });
		this.map.events.addEventListener("update", () => { this.mapUpdated = true; })
		this.network.broadcast("captured", true);
	}

	private nextPath() {
		this.program = this.map.nextPath(this.location);
		this.nextPoint();
		this.destinationE.location = this.map.destination ? this.map.fromMazeCoords(this.map.destination) : Point.Zero;
	}

	public get location(): Point {
		return this.body.entity.location;
	}

	private time: number = 0;
	private kickTo?: Point
	TickBody(dt: number) {
		if (this.kickTo) {
			const delta = this.kickTo.Sub(this.location);
			this.body.Kick(delta.Norm().Mult(this.body.Mass() * 20000));
		}
	}

	protected abstract Think(dt: number, visible: MatrixCell<Map<string, Point>>[]): void;

	Tick(dt: number, visible: MatrixCell<Map<string, Point>>[]) {
		this.Think(dt, visible);

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

export class HonestyBot extends Bot {
	constructor(
		readonly evaluator: Evaluator,
		name: string,
		oddvar: Oddvar,
		body: PolygonBody,
		color: ColoredTexture,
		map: GameMap,
		layer: number,
		network: NetworkCard,
		debug = false) {
		super(name, oddvar, body, color, map, layer, network, debug);
	}
	anotherStates = new Map<string, boolean>();
	protected Think(dt: number, visible: MatrixCell<Map<string, Point>>[]): void {
		this.network.readAll({
			"target": (msg) => {
				if (msg.timestamp < this.map.createdAt || !this.evaluator.Evaluate(this, msg))
					return;
				const l = this.map.toMazeCoords(msg.data)
				this.map.update(l.x, l.y, msg.data, msg.from)
			},
			"captured": (msg) => {
				if (this.evaluator.Evaluate(this, msg)) {
					this.anotherStates.set(msg.from, false);
				}
			},
		});
		visible.forEach(cell => {
			let updated = false;
			cell.value.forEach((point, owner) => {
				if (owner === this.name) {
					this.map.update(cell.point.x, cell.point.y, point, this.name)
					updated = true;
				} else {
					if (!this.anotherStates.get(owner)) {
						this.network.send(owner, "target", point);
						this.anotherStates.set(owner, true);
					}
				}
			});
			if (!updated) {
				this.map.update(cell.point.x, cell.point.y, null, this.name)
			}
		})
	}
}

export class LierBot extends Bot {
	constructor(
		readonly evaluator: Evaluator,
		name: string,
		oddvar: Oddvar,
		body: PolygonBody,
		color: ColoredTexture,
		map: GameMap,
		layer: number,
		network: NetworkCard,
		debug = false) {
		super(name, oddvar, body, color, map, layer, network, debug);
	}
	protected Think(dt: number, visible: MatrixCell<Map<string, Point>>[]): void {
		this.network.readAll({
			"target": (msg) => {
				if (msg.timestamp < this.map.createdAt || !this.evaluator.Evaluate(this, msg))
					return;
				const l = this.map.toMazeCoords(msg.data)
				this.map.update(l.x, l.y, msg.data, msg.from)
			},
			"captured": (msg) => {
				if (this.evaluator.Evaluate(this, msg)) {
					this.network.send(msg.from, "target", this.map.randomFreePoint());
				}
			},
		});
		visible.forEach(cell => {
			this.map.update(cell.point.x, cell.point.y, cell.value.get(this.name) || null, this.name)
		})
	}
}

class Rating {
	constructor(readonly threshold: number,
		readonly trustPayoff: number,
		readonly liePayoff: number) { }
	private list: Record<string, number> = Object.create(null);
	less(name: string, value: number): boolean {
		return this.value(name) < value;
	}
	value(name: string): number {
		return this.list[name] || 0;
	}
	change(name: string, value: number): number {
		return this.list[name] = this.value(name) + value;
	}
	lie(lier: string) {
		this.change(lier, this.liePayoff);
	}
	trust(honestier: string) {
		this.change(honestier, this.trustPayoff);
	}
	isLier(name: string) {
		return this.less(name, this.threshold);
	}
	isHonesty(name: string) {
		return !this.isLier(name);
	}
}

export class RatingBot extends Bot {
	rating: Rating;
	liersMessages: [Point, string][] = [];
	constructor(
		readonly threshold: number,
		readonly trustPayoff: number,
		readonly liePayoff: number,
		name: string,
		oddvar: Oddvar,
		body: PolygonBody,
		color: ColoredTexture,
		map: GameMap,
		layer: number,
		network: NetworkCard,
		debug = false) {
		super(name, oddvar, body, color, map, layer, network, debug);
		this.rating = new Rating(threshold, trustPayoff, liePayoff);
		this.addEventListener("captured", ({ old, where }) => {
			const targetLocation = old.toMazeCoords(where);
			this.liersMessages.forEach(([data, from]) => {
				const msgCoords = old.toMazeCoords(data);
				if (msgCoords.x === targetLocation.x && msgCoords.x === targetLocation.y)
					this.rating.trust(from);
				else
					this.rating.lie(from);
			})
			this.liersMessages.length = 0;
			old.explored.get(targetLocation.x, targetLocation.y)?.sources.forEach(honesty => {
				this.rating.trust(honesty);
			});
			old.targets.filter(point => targetLocation.x != point.x || targetLocation.y !== point.y).forEach(bad => {
				old.explored.get(bad.x, bad.y)!.sources.forEach(lier => {
					this.rating.lie(lier);
				})
			});
		})
	}

	anotherStates = new Map<string, boolean>();
	protected Think(dt: number, visible: MatrixCell<Map<string, Point>>[]): void {
		this.network.readAll({
			"target": (msg) => {
				if (msg.timestamp < this.map.createdAt)
					return;
				if (this.rating.isLier(msg.from)) {
					this.liersMessages.push([msg.data, msg.from]);
					return
				}
				const l = this.map.toMazeCoords(msg.data)
				if (this.map.isConflict(l.x, l.y, msg.data)) {
					if (this.map.explored.get(l.x, l.y)?.sources.has(this.name)) {
						this.rating.lie(msg.from);
						return;
					}
				}
				this.map.update(l.x, l.y, msg.data, msg.from)
			},
			"captured": (msg) => {
				if (this.rating.isLier(msg.from)) {
					this.network.send(msg.from, "target", this.map.randomFreePoint());
				} else {
					this.anotherStates.set(msg.from, false);
				}
			},
		});
		visible.forEach(cell => {
			let updated = false;
			cell.value.forEach((point, owner) => {
				if (owner === this.name) {
					this.map.update(cell.point.x, cell.point.y, point, this.name)
					updated = true;
				} else {
					if (this.rating.isHonesty(owner) && !this.anotherStates.get(owner)) {
						this.network.send(owner, "target", point);
						this.anotherStates.set(owner, true);
					}
				}
			});
			if (!updated) {
				if (this.map.isConflict(cell.point.x, cell.point.y, null)) {
					this.map.explored.get(cell.point.x, cell.point.y)?.sources.forEach(lier => this.rating.lie(lier));
				}
				this.map.update(cell.point.x, cell.point.y, null, this.name)
			}
		})
	}
}