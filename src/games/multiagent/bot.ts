import { Matrix, Point } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar";
import { PolygonBody } from '../../oddvar/physics/body';
import { ColoredTexture } from '../../oddvar/textures';
import { Entity } from '../../oddvar/world';
import { GameMap } from "../utils/game_map";
import { Dir, MatrixCell } from '../../oddvar/labirint/labirint';
import { Message, MessageDataMap, NetworkCard } from './net';
import { Observable } from '../../oddvar/utils';
import { BotMap } from './bot_map';

export interface Evaluator {
	// Можно ли доверять сообщению
	Evaluate(bot: Bot, msg: Message): boolean
}


export interface SendMiddleware {
	Send<T extends keyof MessageDataMap>(bot: Bot, to: string, type: T, data: MessageDataMap[T]): void;
}

export class BotController {
	
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
		this.map.events.addEventListener("update", () => { this.mapUpdated = true; })
		this.network.broadcast("captured", true);
	}

	nextPath() {
		this.program = this.map.nextPath(this.location);
		this.nextPoint();
		this.destinationE.location = this.map.destination ? this.map.fromMazeCoords(this.map.destination) : Point.Zero;
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
				if (msg.timestamp < this.map.createdAt || !this.evaluator.Evaluate(this, msg))
					return;
				const l = this.map.toMazeCoords(msg.data)
				this.map.update(l.x, l.y, msg.data, msg.from)
			},
			"captured": (msg) => {
				if (this.evaluator.Evaluate(this, msg))
					this.anotherStates.set(msg.from, false);
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
						this.sender.Send(this, owner, "target", point);
						this.anotherStates.set(owner, true);
					}
				}
			});
			if (!updated) {
				this.map.update(cell.point.x, cell.point.y, null, this.name)
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
