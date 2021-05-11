import { BarChartRow, ChartWindow, WindowsManager } from "../../web/windows";
import { Point, Size } from "../../oddvar/geometry";
import { Administrator } from "./administrators";
import { Logger } from "../../oddvar/utils/logger";

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
			let vec = this.administrators[i].Work(dt);
			vec = vec ? vec : new Point(0, 0);
			direction = direction.Add(vec);
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
		let vec = this.administrators[this.index].Work(dt);
		vec = vec ? vec : new Point(0, 0);
		return vec;
	}
}

export class DictaturaUnity extends Unity {
	Work(dt: number): Point {
		if (this.administrators.length == 0) {
			return new Point(0, 0);
		}
		let vec = this.administrators[0].Work(dt);
		vec = vec ? vec : new Point(0, 0);
		return vec;
	}
}

export class SmartUnity extends Unity {
	vector = new Point(1, 0);

	constructor(administrators: Administrator[]) {
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
			let vec = this.administrators[i].Work(dt);
			vec = vec ? vec : new Point(0, 0);
			buffer[i] = vec;
			if (buffer[i].Len() < 1e-10) {
				distribution[i] = 0;
				continue;
			}
			const delta = this.vector.Dot(buffer[i]);
			// distribution[i] =  Math.pow(1 - Math.acos(delta) / Math.PI, 10);
			distribution[i] =  delta < -0.5 ? 1e-10 : delta < 0.5 ? 0.1 : 2;
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

const Colors = [
	"blue", "red", "green",
	"purple", "gold", "peru", "plum", "silver"
];

export class WeightedUnity extends Unity {
	index = 0;
	weights: number[];
	companions: number[] = [];
	logger: Logger;
	rows: BarChartRow[];
	chart: ChartWindow;

	constructor(administrators: Administrator[], private winMan: WindowsManager, size: Size, startTime: number = 10) {
		super(administrators);
		this.logger = winMan.CreateLoggerWindow('My console', new Point(size.width, size.height / 2), new Size(administrators.length*4+4, 30))
		this.rows = administrators.map((a, i) => new BarChartRow(i.toString(), 0, Colors[i % Colors.length]))
		winMan.CreateBarChartWindow('Time', this.rows, new Point(size.width * 1.5, 0), new Size(30, administrators.length*2))
		this.weights = administrators.map(a => startTime)
		this.chart = winMan.CreateChartWindow('last unit', new Point(size.width * 1.5, 200), new Size(30, 10))
	}

	timer = 0;
	Work(dt: number): Point {
		this.timer += dt;
		if (this.timer > 0.2) {
			//this.chart.append(this.weights[0] * 10)
			this.timer = 0;
		}
		if (this.weights[this.index] <= 0) {
			let len = this.companions.length;
			let next = this.index;
			if (len > 1) {
				while (next == this.index) {
					next = this.companions[((Math.random() * len) | 0) % len];
				}
			}
			else {
				len = this.administrators.length
				while (next == this.index) {
					next = ((Math.random() * len) | 0) % len;
				}
			}
			this.logger.WarnLine(`switch to ${next}`)
			this.index = next
		}

		this.logger.InfoLine(`${this.index}: ${this.weights.map((w, i) => `${i}: ${w.toFixed(2)}`).join(", ")}`);

		let vec = this.administrators[this.index].Work(dt);
		vec = vec ? vec : new Point(0, 0);
		const work = vec.Norm();
		this.companions = [this.index]
		for (let i = 0; i < this.administrators.length; ++i) {
			this.weights[i] += dt / this.administrators.length;
			if (i == this.index) continue;
			let currentWork = this.administrators[i].Work(dt);
			currentWork = currentWork ? currentWork : new Point(0, 0);
			if (currentWork.Dot(work) > 0.5) {
				this.companions.push(i)
			}
		}
		this.rows[this.index].value += dt;
		const payment = dt / this.companions.length;
		this.companions.forEach(i => this.weights[i] -= payment);
		return work;
	}
}

