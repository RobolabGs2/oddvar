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

export class DictaturaUnity extends Unity {
	Work(dt: number): Point {
		if (this.administrators.length == 0) {
			return new Point(0, 0);
		}
		return this.administrators[0].Work(dt);
	}
}

export class SmartUnity extends Unity {
	vector = new Point(1, 0);

	constructor(administrators: Administrator[], private period: number = 5) {
		super(administrators);
	}

	Work(dt: number): Point {
		if (this.administrators.length == 0) {
			return new Point(0, 0);
		}
		const distribution = new Array<number>(this.administrators.length);
		const buffer = new Array<Point>(this.administrators.length);
		let sum = 0;
		for (let i = 0; i < this.administrators.length; ++i) {
			buffer[i] = this.administrators[i].Work(dt);
			if (buffer[i].Len() < 1e-10) {
				distribution[i] = 0;
				continue;
			}
			const delta = this.vector.Dot(buffer[i]);
			// distribution[i] =  Math.pow(1 - Math.acos(delta) / Math.PI, 10);
			distribution[i] =  delta < -0.5 ? 1e-10 : 1;
			sum += distribution[i];
		}
		if (sum < 1e-10) {
			return new Point(0, 0);
		}
		const choice = Math.random();
		let counter = 0;
		for (let i = 0; i < distribution.length; ++i) {
			counter += distribution[i] / sum;
			if (choice <= counter) {
				return this.vector = buffer[i];
			}
		}
		console.log("oops");
		return this.vector = buffer[buffer.length - 1];
	}
}
