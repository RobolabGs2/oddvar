import { Point } from "../oddvar/geometry";


export class Labirint {
	private matrix = new Array<Array<boolean>>();
	constructor(readonly width: number, readonly height: number) {
		for (let i = 0; i < width; ++i) {
			this.matrix.push(new Array<boolean>(height).fill(true));
		}
	}

	public And(l: Labirint): Labirint {
		if (l.width != this.width || l.height != this.height) {
			throw new Error("Лабиринты не сходятся!!!");
		}
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height ; ++j) {
				this.set(i, j, this.get(i, j) && l.get(i, j));
			}
		}
		return this;
	}

	public Or(l: Labirint): Labirint {
		if (l.width != this.width || l.height != this.height) {
			throw new Error("Лабиринты не сходятся!!!");
		}
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height ; ++j) {
				this.set(i, j, this.get(i, j) || l.get(i, j));
			}
		}
		return this;
	}

	public Not(): Labirint {
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height ; ++j) {
				this.set(i, j, !this.get(i, j));
			}
		}
		return this;
	}

	public get(x: number, y: number): boolean {
		return this.matrix[x][y];
	}

	public set(x: number, y: number, value: boolean) {
		this.matrix[x][y] = value;
	}

	Step(x: number, y: number, n = 20) {
		if (x < 0 || this.width <= x || y < 0 || this.height <= y) {
			return;
		}
		if (!this.get(x, y)) {
			return;
		}
		this.set(x, y, false);
		if (Math.random() < n) this.Step(x - 1, y, n * 0.9);
		if (Math.random() < n) this.Step(x + 1, y, n * 0.9);
		if (Math.random() < n) this.Step(x, y + 1, n * 0.9);
		if (Math.random() < n) this.Step(x, y - 1, n * 0.9);
	}

	public static Generate(width: number, height: number): Labirint{
		const result = new Labirint(width, height);
		result.Step((width / 2)|0, (height / 2)|0);
		for (let i = 0; i < 10; ++i) {
			result.Step((Math.random() * width)|0, (Math.random() * height)|0);
		}
		return result;
	}

	public static Frame(width: number, height: number, border: number = 1) {
		const result = new Labirint(width, height);
		for (let i = border; i < width - border; ++i) {
			for (let j = border; j < height - border; ++j) {
				result.set(i, j, false);
			}
		}
		return result;
	}
}
