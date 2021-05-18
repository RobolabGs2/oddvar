import { Dir } from '../../oddvar/labirint/labirint';
import { Point } from "../../oddvar/geometry";
import { IBody } from "../../oddvar/physics/body";
import { GameMap } from "../utils/game_map";
import { Entity } from '../../oddvar/world';
import { NormalModuleReplacementPlugin } from 'webpack';


export interface Administrator {
	Work(dt: number): Point | null;
}

export class RandomAdministrator implements Administrator {
	Work(dt: number): Point {
		return new Point(Math.random(), Math.random()).Sub(new Point(0.5, 0.5));
	}
}

export class PointAdministrator implements Administrator {
	private nextPoint: Point = new Point(0, 0);
	private path: Dir[] = new Array();
	private endwork = false;

	constructor(readonly bot: IBody, readonly map: GameMap, readonly target: Entity) {
		this.updatePath();
	}

	public SetEndwork() {
		this.endwork = true
	}

	Work(dt: number): Point | null {
		if (this.nextPoint.Sub(this.bot.entity.location).Len() > this.map.cellSize.width * 1.5) {
			this.updatePath();
		}
		if (this.nextPoint.Sub(this.bot.entity.location).Len() < this.map.cellSize.width / 5) {
			this.incNextPoint()
		}
		if (this.endwork) {
			this.endwork = false;
			return null;
		}
		return this.nextPoint.Sub(this.bot.entity.location).Norm();
	}

	private incNextPoint(): boolean {
		if (this.path.length == 0) {
			this.updatePath();
			this.SetEndwork();
		}
		Dir.movePoint(this.path[0], this.nextPoint, this.map.cellSize.width)
		this.path = this.path.slice(1)
		return true;
	}

	public updatePath() {
		let path = this.map.findPath(this.bot.entity.location, this.target.location);
		this.path = path ? path : new Array();
		this.nextPoint = this.map.fromMazeCoords(this.map.toMazeCoords(this.bot.entity.location.Clone()));
	}
}

