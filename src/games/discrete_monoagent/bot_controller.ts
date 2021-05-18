import { Point } from "../../oddvar/geometry";
import { Dir } from "../../oddvar/labirint/labirint";
import { Body } from "../../oddvar/physics/body";
import { GameMap } from "../utils/game_map";
import { Manager } from "./manager";


export class BotController {
	private targetPoint: Point;

	constructor(private manager: Manager, private body: Body, private map: GameMap) {
		this.targetPoint = body.entity.location.Clone();
	}

	Tick(dt: number) {
		if (this.body.entity.location.Dist(this.targetPoint) < this.map.cellSize.width / 5) {
			const direction = this.manager.Direction();
			this.targetPoint = this.map.fromMazeCoords(
				this.map.toMazeCoords(this.body.entity.location).
				Add(Dir.Vector(direction)))
		}
		const vector = this.targetPoint.Sub(this.body.entity.location).Norm()
		this.body.Kick(vector.Mult(this.body.Mass() * 500))
	}
}
