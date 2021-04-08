import { expect } from "chai";
import { PriorityQueue } from "./utils";

describe("PriorityQueue", () => {
	type Elem = { tag: number, time: number, value: number };
	it("simple case", () => {
		const queue = new PriorityQueue<Elem>();
		const expected = [];
		for (let i = 10; i > 0; i--) {
			queue.Add({ tag: 0, time: i, value: i });
			expected.push(11-i);
		}
		const actual = [];
		while(queue.size)
			actual.push(queue.enqueue()?.value);
		expect(actual).deep.equal(expected);
	});
});