import { expect } from "chai";
import { Point } from "../oddvar/geometry";
import { Dir, Labirint } from "./labirint";

const findPathTests = (findPath: ((this: Labirint, start: Point, finish: Point) => Dir[]|undefined)) => {
	return () => {
		it("should find path in empty maze", () => {
			const emptyMaze = Labirint.FromMatrix([[0, 0], [0, 0]]);
			const path = findPath.call(emptyMaze, new Point(0, 0), new Point(1, 1));
			expect(path?.length).equal(2);
		});
		it("should not find path in maze with a wall", () => {
			const maze = Labirint.FromMatrix([
				[0, 0],
				[1, 1],
				[0, 0]
			]);
			const path = findPath.call(maze, new Point(0, 0), new Point(1, 2));
			expect(path).undefined;
		});
		it("should find path in maze with walls", () => {
			const maze = Labirint.FromMatrix([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			]);
			const path = findPath.call(maze, new Point(0, 0), new Point(0, 2));
			expect(path).deep.equal([
				Dir.RIGHT, Dir.RIGHT, Dir.RIGHT,
				Dir.DOWN, Dir.DOWN, Dir.DOWN,
				Dir.LEFT, Dir.LEFT, Dir.LEFT,
				Dir.UP]);
		});
		it("diffucult maze", () => {
			const maze = Labirint.Symmetry([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			], "XY", 3);
			const start = new Point(0, 0);
			const finish = new Point(maze.width - 1, maze.height - 1);
			const path = findPath.call(maze, start, finish);
			expect(path).not.undefined;
			expect(path?.length).equal(62);
		});
		it("big maze", () => {
			const maze = Labirint.Symmetry([
				[0, 0, 0, 0],
				[1, 1, 1, 0],
				[0, 1, 1, 0],
				[0, 0, 0, 0],
			], "XY", 6);
			const start = new Point(0, 0);
			const finish = new Point(maze.width - 1, maze.height - 1);
			const path = findPath.call(maze, start, finish);
			expect(path).not.undefined;
			expect(path?.length).equal(510);
		});
	}
}


describe("Labirint.AStar", findPathTests(Labirint.prototype.FindPath));
describe("Labirint.BFS", findPathTests(Labirint.prototype.FindPathBFS));
