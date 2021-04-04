import { Point, Size } from "../oddvar/geometry";

export type WallCreator = (center: Point, rotation: number, size: Size) => void;

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

	Draw(size: Size, shift: Point, createWall: WallCreator) {
		function drawWall(i: number, j: number, last: number) {
			createWall(new Point((i + 0.5) * size.width + shift.x, ((j + last - 1) / 2 + 0.5) * size.height + shift.y), 0,
				new Size(size.width, (j - last) * size.height));
		}
		for (let i = 0; i < this.width; ++i) {
			let last = 0;
			for (let j = 0; j < this.height; ++j) {
				if (!this.get(i, j)) {
					if (last < j) {
						drawWall(i, j, last);
					}
					last = j + 1;
				}
			}
			if (last < this.height) {
				drawWall(i, this.height, last);
			}
		}
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

	public static Symmetry(origin: (boolean|number)[][]|Labirint, axis: "X" | "Y" | "XY" = "XY"): Labirint {
		if(origin instanceof Labirint)
			origin = origin.matrix;
		const originWidth = origin[0].length;
		const originHeight = origin.length;
		const yRepeat = (axis.includes("Y") ? 2 : 1);
		const xRepeat = (axis.includes("X") ? 2 : 1);
		const result = new Labirint(originWidth*xRepeat, originHeight*yRepeat);
		for (let i = 0; i < yRepeat; i++) {
			for (let j = 0; j < xRepeat; j++) {
				origin.forEach((l, _i) => {
					l.forEach((cell, _j) => {
						const y = (i % 2) ? 2 * originHeight - _i - 1 : originHeight * i + _i
						const x = (j % 2) ? 2 * originWidth - _j - 1 : originWidth * j + _j
						result.set(x, y, cell == true);
					})
				})
			}
		}
		return result;
	}
}
