import { PrettyPrint } from "../debug";
import { Point, Size } from "../geometry";
import { PriorityQueue, Tagable } from "../utils";

export type WallCreator = (center: Point, rotation: number, size: Size) => void;

export function inRange(x: number, max: number, min = 0) {
	return min <= x && x < max;
}

export type MatrixCell<T> = {
	point: Point;
	depth: number;
	value: T;
};

export class DataMatrix<T> {
	protected matrix = new Array<Array<T>>();
	constructor(readonly width: number, readonly height: number, defaultValue: T | (() => T)) {
		if (typeof defaultValue === "function") {
			for (let i = 0; i < height; ++i) {
				this.matrix.push(new Array<T>(width));
				for (let j = 0; j < width; ++j) {
					this.set(j, i, (<() => T>defaultValue)());
				}
			}
		} else {
			for (let i = 0; i < height; ++i) {
				this.matrix.push(new Array<T>(width).fill(defaultValue));
			}
		}
	}

	public get(x: number, y: number): T {
		return this.matrix[y][x];
	}

	public set(x: number, y: number, value: T) {
		this.matrix[y][x] = value;
	}

	// Если нет в первом, берём из второго
	public MergeOr<E, R extends DataMatrix<E | T>>(l: DataMatrix<E>, dst: R = <R>new DataMatrix<E | T>(l.width, l.height, l.get(0, 0))): R {
		if (l.width != this.width || l.height != this.height) {
			throw new Error("Лабиринты не сходятся!!!");
		}
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height; ++j) {
				dst.set(i, j, this.get(i, j) || l.get(i, j));
			}
		}
		return dst;
	}

	// Если есть в первом, берём из второго
	public MergeAnd<E, R extends DataMatrix<E | T>>(l: DataMatrix<E>, dst: R = <R>new DataMatrix<E | T>(l.width, l.height, l.get(0, 0))): R {
		if (l.width != this.width || l.height != this.height) {
			throw new Error("Лабиринты не сходятся!!!");
		}
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height; ++j) {
				dst.set(i, j, this.get(i, j) && l.get(i, j));
			}
		}
		return dst;
	}

	FindPathBFS(start: Point, end: Point, wall: T): Dir[] | undefined {
		const from = new DataMatrix<Dir>(this.width, this.height, -1);
		start = start.Clone();
		const queue = [start];
		const startPoint = 9;
		from.set(start.x, start.y, startPoint);
		while (queue.length) {
			const v = queue.shift()!;
			if (isFinish(v)) {
				const answer = new Array<Dir>();
				for (let to = v; true;) {
					const dir = from.get(to.x, to.y);
					if (dir === startPoint)
						break;
					answer.push(dir);
					Dir.movePoint(Dir.Reverse(dir), to)
				}
				return answer.reverse();
			}
			this.nextPoints(v, from, wall, (dir, next) => {
				from.set(next.x, next.y, dir);
				queue.push(next);
			});
		}
		function isFinish(v: Point) {
			return v.x === end.x && v.y === end.y;
		}
		return;
	}

	BFS(start: Point, depth: number, wall: T): MatrixCell<T>[] {
		const from = new DataMatrix<Dir>(this.width, this.height, -1);
		start = start.Clone();
		const value = this.get(start.x, start.y);
		const queue = [{ point: start, depth: 0, value }];
		const startPoint = 9;
		from.set(start.x, start.y, startPoint);
		for (let i = 0; i !== queue.length; ++i) {
			const v = queue[i];
			if (v.depth === depth)
				break
			this.nextPoints(v.point, from, wall, (dir, next, value) => {
				from.set(next.x, next.y, dir);
				queue.push({ point: next, depth: v.depth + 1, value });
			});
		}
		return queue;
	}

	FindPath(start: Point, finish: Point, wall: T): Dir[] | undefined {
		return this.FindPathAStar(start, Point.prototype.Manhattan.bind(finish), wall);
	}

	// Если эвристика вернула 0 - точка считается местом назначения
	FindPathAStar(start: Point, heuristic: (p: Point) => number, wall: T): Dir[] | undefined {
		const from = new DataMatrix<Dir>(this.width, this.height, -1);
		const queue = new PriorityQueue<PointItem>();
		queue.Add(new PointItem(start, 0, heuristic(start), 9))
		while (queue.size) {
			const v = queue.enqueue();
			if (from.get(v.p.x, v.p.y) !== -1)
				continue;
			from.set(v.p.x, v.p.y, v.dir);
			if (v.g === 0) {
				const answer = new Array<Dir>(v.length);
				let i = v.length;
				for (let to = v.p; true;) {
					const dir = from.get(to.x, to.y)
					if (to.x === start.x && to.y === start.y)
						break;
					answer[--i] = dir;
					Dir.movePoint(Dir.Reverse(dir), to)
				}
				return answer;
			}

			this.nextPoints(v.p, from, wall, (dir, next) =>
				queue.Add(new PointItem(next, v.length + 1, heuristic(next), dir)));
		}
		return;
	}

	private nextPoints(v: Point, from: DataMatrix<Dir>, wall: T, handler: (dir: Dir, next: Point, value: T) => void) {
		for (let dir: Dir = 0; dir < 4; dir++) {
			const next = Dir.movePoint(dir, v.Clone());
			if (inRange(next.y, this.height) &&
				inRange(next.x, this.width) &&
				from.get(next.x, next.y) === -1 &&
				this.get(next.x, next.y) !== wall)
				handler(dir, next, this.get(next.x, next.y));
		}
	}

	toString(valueMapper: (x: T) => string = (x) => `${x}`): string {
		return PrettyPrint.matrix(this.matrix, valueMapper);
	}
}

export class Labirint extends DataMatrix<boolean>{
	constructor(readonly width: number, readonly height: number) {
		super(width, height, true);
	}

	public And(l: Labirint): Labirint {
		return this.MergeAnd(l, this);
	}

	public Or(l: Labirint): Labirint {
		return this.MergeOr(l, this);
	}

	public Not(): Labirint {
		for (let i = 0; i < this.width; ++i) {
			for (let j = 0; j < this.height; ++j) {
				this.set(i, j, !this.get(i, j));
			}
		}
		return this;
	}

	public Frame(border = 1): Labirint {
		return this.Or(Labirint.Frame(this.width, this.height, border));
	}

	Step(x: number, y: number, n = 20) {
		if (!inRange(x, this.width) || !inRange(y, this.height)) {
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

	public static Generate(width: number, height: number): Labirint {
		const result = new Labirint(width, height);
		result.Step((width / 2) | 0, (height / 2) | 0);
		for (let i = 0; i < 10; ++i) {
			result.Step((Math.random() * width) | 0, (Math.random() * height) | 0);
		}
		return result;
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

	BFS(start: Point, depth: number): { point: Point, depth: number, value: boolean }[] {
		return super.BFS(start, depth, true);
	}
	FindPathBFS(start: Point, end: Point): Dir[] | undefined {
		return super.FindPathBFS(start, end, true);
	}

	FindPath(start: Point, finish: Point): Dir[] | undefined {
		return this.FindPathAStar(start, Point.prototype.Manhattan.bind(finish));
	}

	// Если эвристика вернула 0 - точка считается местом назначения
	FindPathAStar(start: Point, heuristic: (p: Point) => number): Dir[] | undefined {
		return super.FindPathAStar(start, heuristic, true);
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

	public static FromMatrix(matrix: (boolean | number)[][]): Labirint {
		const result = new Labirint(matrix[0].length, matrix.length);
		matrix.forEach((l, y) => {
			l.forEach((cell, x) => {
				result.set(x, y, cell == true);
			})
		})
		return result;
	}

	public static Symmetry(origin: (boolean | number)[][] | Labirint, axis: "X" | "Y" | "XY" = "XY", deep = 1): Labirint {
		if (origin instanceof Labirint)
			origin = origin.matrix;
		const originWidth = origin[0].length;
		const originHeight = origin.length;
		const yRepeat = (axis.includes("Y") ? 2 : 1);
		const xRepeat = (axis.includes("X") ? 2 : 1);
		const result = new Labirint(originWidth * xRepeat, originHeight * yRepeat);
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
		return deep > 1 ? this.Symmetry(result, axis, deep - 1) : result;
	}

	public static SymmetryOdd(origin: (boolean | number)[][] | Labirint, axis: "X" | "Y" | "XY" = "XY", deep = 1): Labirint {
		if (origin instanceof Labirint)
			origin = origin.matrix;
		const originWidth = origin[0].length;
		const originHeight = origin.length;
		const yRepeat = (axis.includes("Y") ? 2 : 1);
		const xRepeat = (axis.includes("X") ? 2 : 1);
		const result = new Labirint(originWidth * xRepeat - 1, originHeight * yRepeat - 1);
		for (let i = 0; i < yRepeat; i++) {
			for (let j = 0; j < xRepeat; j++) {
				origin.forEach((l, _i) => {
					l.forEach((cell, _j) => {
						const y = (i % 2) ? 2 * originHeight - _i - 2 : originHeight * i + _i
						const x = (j % 2) ? 2 * originWidth - _j - 2 : originWidth * j + _j
						result.set(x, y, cell == true);
					})
				})
			}
		}
		return deep > 1 ? this.SymmetryOdd(result, axis, deep - 1) : result;
	}

	toString(): string {
		return PrettyPrint.matrix(this.matrix, (wall) => wall ? "#" : " ")
	}
}

export enum Dir {UP, DOWN, LEFT, RIGHT}
export namespace Dir {
	export function Reverse(d: Dir): Dir {
		switch (d) {
			case Dir.UP: return Dir.DOWN;
			case Dir.DOWN: return Dir.UP;
			case Dir.LEFT: return Dir.RIGHT;
			case Dir.RIGHT: return Dir.LEFT;
		}
		throw new TypeError(`Unknown Dir: ${d}`);
	}
	export function Angle(d: Dir): number {
		switch (d) {
			case Dir.UP: return Math.PI * 1.5;
			case Dir.DOWN: return Math.PI * 0.5;
			case Dir.LEFT: return Math.PI;
			case Dir.RIGHT: return 0;
		}
		throw new TypeError(`Unknown Dir: ${d}`);
	}
	// Перемещает точку по направлению
	export function movePoint(p: Dir, s: Point, count: number = 1): Point {
		switch (p) {
			case Dir.UP: s.y -= count; break;
			case Dir.DOWN: s.y += count; break;
			case Dir.LEFT: s.x -= count; break;
			case Dir.RIGHT: s.x += count; break;
		}
		return s;
	}
	// Сдвигает точку, чтобы она соблюдала правила ПДД с левосторонним движением
	export function shiftPoint(p: Dir, s: Point, count: number = 1): Point {
		switch (p) {
			case Dir.UP: s.x += count; break;
			case Dir.DOWN: s.x -= count; break;
			case Dir.LEFT: s.y += count; break;
			case Dir.RIGHT: s.y -= count; break;
		}
		return s;
	}
}

class PointItem implements Tagable {
	readonly time: number = this.length + this.g;
	constructor(readonly p: Point, readonly length: number, readonly g: number, readonly dir: Dir) { }
}
