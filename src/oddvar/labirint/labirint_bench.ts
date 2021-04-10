import { Suite } from "mocha";
import { Point } from "../geometry";
import { Dir, Labirint } from "./labirint";



const findPathTests = (findPath: ((this: Labirint, start: Point, finish: Point) => Dir[]|undefined)) => {
	const bench = (maze: Labirint, start: Point, finish: Point, count = 1000) => {
		const size = `${maze.width}x${maze.height}`;
		console.time(size)
		for(let i = 0; i < count; i++)
			findPath.call(maze, start, finish);
		console.timeEnd(size)
	
	}
	return function(this: Suite) {
		this.timeout("10s")
		it("little maze", () => {
			const maze = Labirint.FromMatrix([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			]);
			bench(maze, new Point(0, 0), new Point(0, 2));
		});
		it("medium maze", () => {
			const maze = Labirint.Symmetry([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			], "XY", 3);
			bench(maze, new Point(0, 0), new Point(maze.width - 1, maze.height - 1));
		});
		it("big maze", () => {
			const maze = Labirint.Symmetry([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			], "XY", 6);
			bench(maze, new Point(0, 0), new Point(maze.width - 1, maze.height - 1));
		});
	}
}


describe("Labirint.AStar", findPathTests(Labirint.prototype.FindPath));
describe("Labirint.BFS", findPathTests(Labirint.prototype.FindPathBFS));
