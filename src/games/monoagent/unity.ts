import { time } from "node:console";
import { Point } from "../../oddvar/geometry";
import { Administrator } from "./administrators";

export abstract class Unity
{
	constructor(protected administrators: Administrator[]) {
	}

	abstract Work(dt: number): Point;
}

export class DemocraticUnity extends Unity {
	Work(dt: number): Point {
		let direction = new Point(0, 0);
		for (let i = 0; i < this.administrators.length; ++i) {
			direction = direction.Add(this.administrators[i].Work(dt));
		}
		return direction;
	}
}

export class TimerUnity extends Unity {
	private timer = 0;
	private index = 0;

	constructor(administrators: Administrator[], private period: number = 5) {
		super(administrators);
	}

	Work(dt: number): Point {
		if (this.administrators.length == 0) {
			return new Point(0, 0);
		}
		this.timer += dt;
		if (this.timer > this.period) {
			this.timer = 0;
			this.index = (this.index + 1) % this.administrators.length;
		}
		return this.administrators[this.index].Work(dt);
	}
}
