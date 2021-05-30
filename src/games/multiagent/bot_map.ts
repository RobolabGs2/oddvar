import { Point } from "../../oddvar/geometry";
import { DataMatrix, Dir } from "../../oddvar/labirint/labirint";
import { Observable } from "../../oddvar/utils";
import { GameMap } from "../utils/game_map";

function pointEquals(p: Point | undefined, x: number, y: number): boolean {
	return p !== undefined && p.x === x && p.y === y;
}

function pointsEqual(p: Point | undefined, p2: Point | undefined): boolean {
	return p !== undefined && p2 !== undefined && p.x === p2.x && p.y === p2.y;
}

type BotMapCell = {
	data: null | Point;
	sources: Set<string>;
};

export interface BotMapEvents {
	update: { map: BotMap, x: number, y: number, cell: BotMapCell };
}

class EmbeddedObservable<T> extends Observable<T> {
	public dispatch<K extends keyof T>(type: K, event: T[K]) {
		this.dispatchEvent(type, event);
	}
}

export class BotMap extends GameMap {
	explored: DataMatrix<undefined | BotMapCell>
	exploredCount = 0;
	freeCount: number = 0;
	
	public get progress() : number {
		return this.exploredCount/this.freeCount;
	}
	
	// Буфер для преобразования в строку
	private merged: DataMatrix<undefined | BotMapCell | boolean>
	// in maze coords
	targets: Point[] = [];
	// Конец последнего построенного пути
	destination?: Point;

	constructor(gameMap: GameMap, readonly createdAt: number) {
		super(gameMap.maze, gameMap.size);
		this.explored = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
		this.merged = new DataMatrix(gameMap.maze.width, gameMap.maze.height, undefined);
		for (let x = 0; x < gameMap.maze.width; x++)
			for (let y = 0; y < gameMap.maze.height; y++)
				if (!gameMap.maze.get(x, y)) this.freeCount++;
	}
	private _events = new EmbeddedObservable<BotMapEvents>();

	public get events(): Observable<BotMapEvents> {
		return this._events;
	}

	isConflict(x: number, y: number, data: null | Point): boolean {
		if (this.maze.get(x, y))
			return true;
		const oldData = this.explored.get(x, y);
		if (oldData === undefined)
			return false;
		return !((oldData.data === null && data === null) || (oldData.data !== null && data !== null));
	}

	isNew(x: number, y: number): boolean {
		return this.explored.get(x, y) === undefined;
	}

	update(x: number, y: number, data: null | Point, source: string): boolean {
		const isConflict = this.isConflict(x, y, data);
		const isNew = this.isNew(x, y);
		if (isNew || isConflict) {
			if (isConflict && data === null && this.targets.length > 0) {
				const i = this.targets.findIndex(point => pointEquals(point, x, y));
				if (i !== -1) {
					if (i === 0) this.destination = undefined;
					for (let j = i + 1; j < this.targets.length; j++) {
						this.targets[j - 1] = this.targets[j];
					}
					this.targets.pop();
				}
			}
			const cell = { data, sources: new Set([source]) };
			if (!pointsEqual(this.destination, this.targets[0]) && pointEquals(this.destination, x, y)) {
				// Мы разведали новую зону - можно не доходить до неё, если уже увидели, что в ней
				this.destination = undefined;
			}
			this.explored.set(x, y, cell);
			if (data !== null)
				this.targets.push(new Point(x, y));
			this._events.dispatch("update", { map: this, x, y, cell });
			if (isNew) this.exploredCount++;
			return true;
		}
		this.explored.get(x, y)!.sources.add(source);
		return false;
	}
	nextPath(from: Point): Dir[] | undefined {
		from = this.toMazeCoords(from);
		if (this.targets.length) {
			this.destination = this.targets[0];
			return this.maze.FindPath(from, this.targets[0]);
		}
		const path = this.maze.FindPathAStar(from, (p) => {
			if (this.explored.get(p.x, p.y) === undefined)
				return 0;
			return this.maze.width + this.maze.height - from.Manhattan(p);
		});
		this.destination = path?.reduce((p, d) => Dir.movePoint(d, p), from);
		return path;
	}
	toString() {
		return this.maze.MergeOr(this.explored, this.merged).toString(x => {
			if (x === undefined)
				return "?";
			if (x === true)
				return "#";
			if (typeof x === "object")
				if (x.data === null)
					return ".";
			return "T";
		})
	}
}