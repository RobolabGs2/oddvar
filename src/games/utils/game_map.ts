import { Point, Size } from '../../oddvar/geometry';
import { Labirint } from '../../oddvar/labirint/labirint';
import { WallCreator } from './wall_manager';


export class GameMap {
	constructor(
		readonly maze: Labirint,
		readonly size: Size = new Size(500, 500)
	) {
		this.cellSize = new Size(size.width / maze.width, size.height / maze.height);
	}
	readonly cellSize: Readonly<Size>;

	Draw(createWall: WallCreator) {
		this.maze.Draw(this.cellSize, Point.Zero, createWall);
	}

	toMazeCoords(p: Point): Point {
		return new Point((p.x / this.cellSize.width) | 0, (p.y / this.cellSize.height) | 0);
	}

	fromMazeCoords(p: Point): Point {
		return new Point((p.x + 0.5) * this.cellSize.width, (p.y + 0.5) * this.cellSize.height);
	}
}
