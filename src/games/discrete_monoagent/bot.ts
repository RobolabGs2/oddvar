import { Dir } from '../../oddvar/labirint/labirint';
import { Point } from "../../oddvar/geometry";
import { IBody } from '../../oddvar/physics/body';
import { GameMap } from '../utils/game_map';
import { Entity } from '../../oddvar/world';
import { resourceUsage } from 'node:process';


export interface Bot {
	readonly typeName: string;
	Path(): Dir[];
}


export class PointBot implements Bot {
	readonly typeName = "Точка"
	private nextPoint: Point = new Point(0, 0);

	constructor(readonly body: IBody, readonly map: GameMap, readonly target: Entity) {
	}

	public Path() {
		const path = this.map.findPath(this.body.entity.location, this.target.location);
		return path ? path: [];
	}
}

export class RandomBot implements Bot {
	readonly typeName = "Рандом"
	private nextPoint: Point = new Point(0, 0);

	constructor() {
	}

	public Path() {
		const len = (Math.random() * 10)|0;
		let result = new Array<Dir>();
		for (let i = 0; i < len; ++i) {
			result.push((Math.random() * 4) | 0);
		}
		return result;
	}
}

export class PseudoPointBot {
	readonly typeName = "Псевдоточка"
	constructor(readonly body: IBody, readonly map: GameMap) {
	}

	public Path() {
		const path = this.map.findPath(this.body.entity.location, this.GenerateInconflictPoint());
		return path ? path: [];
	}

	protected GenerateInconflictPoint(): Point {
		const p = new Point((Math.random() * this.map.maze.width) | 0, (Math.random() * this.map.maze.height) | 0);
		const result = this.map.fromMazeCoords(p);
		if (this.map.maze.get(p.x, p.y))
			return this.GenerateInconflictPoint();
		return result;
	}
}
