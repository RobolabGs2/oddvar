import { Dir } from '../../oddvar/labirint/labirint';
import { Point } from "../../oddvar/geometry";
import { IBody } from "../../oddvar/physics/body";
import { GameMap } from "../utils/game_map";
import { Entity } from '../../oddvar/world';


export interface Administrator
{
	Work(dt: number): Point;
}

export class RandomAdministrator implements Administrator
{
	Work(dt: number): Point {
		return new Point(Math.random(), Math.random()).Sub(new Point(0.5, 0.5));
	}
}

export class PointAdministrator implements Administrator
{
	private nextPoint: Point = new Point(0, 0);
	private path: Dir[] = new Array();

	constructor(readonly bot: IBody, readonly map: GameMap, readonly target: Entity) {
		this.updatePath();
	}

	Work(dt: number): Point {
		if (this.nextPoint.Sub(this.bot.entity.location).Len() > this.map.cellSize.width * 1.5) {
			this.updatePath();
		}
		if (this.nextPoint.Sub(this.bot.entity.location).Len() < this.map.cellSize.width / 5) {
			this.incNextPoint();
		}
		return this.nextPoint.Sub(this.bot.entity.location).Norm();
	}

	private incNextPoint() {
		if (this.path.length == 0) {
			return this.updatePath();
		}
		switch (this.path[0]) {
			case Dir.LEFT: this.nextPoint.x -= this.map.cellSize.height; break;
			case Dir.RIGHT: this.nextPoint.x += this.map.cellSize.height; break;
			case Dir.UP: this.nextPoint.y -= this.map.cellSize.width; break;
			case Dir.DOWN: this.nextPoint.y += this.map.cellSize.width; break;
		}
		this.path = this.path.slice(1)
	}

	public updatePath() {
		let path = this.map.findPath(this.bot.entity.location, this.target.location);
		this.path = path ? path : new Array();
		this.nextPoint = this.map.fromMazeCoords(this.map.toMazeCoords(this.bot.entity.location.Clone()));
	}
}

