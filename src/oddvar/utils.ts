export function getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
	if (nullable !== null && nullable !== undefined) {
		return nullable;
	}
	return default_;
}

export function RandomElem<T>(elems: T[]): T {
	return elems[(Math.random() * elems.length) | 0];
}

export type MapOfArrays<T> = {
	[K in keyof T]: T[K][]
}

export type EventHandler<T, This = unknown> = {
	[K in keyof T]: (this: This, data: T[K]) => void
}

export function ConvertRecord<T1, T2>(a: Record<string, T1>, mapper: (key: string, origin: T1) => T2): Record<string, T2> {
	return Object.fromEntries(Object.entries(a).map(([k, f]) => [k, mapper(k, f)]));
}

type ListenersMap<EventsMap, This = unknown> = MapOfArrays<EventHandler<EventsMap, This>>;

export class Observable<EventsMap, This = unknown> {
	protected listeners: ListenersMap<EventsMap, This> = new Proxy<ListenersMap<EventsMap, This>>({} as ListenersMap<EventsMap, This>, {
		get: (map, propertyName, receiver) => {
			let property = Reflect.get(map, propertyName, receiver);
			if(property !== undefined)
				return property;
			property = [];
			Reflect.set(map, propertyName, property, receiver);
			return property;
		}
	});
	// Возвращает индекс слушателя
	public addEventListener<E extends keyof EventsMap>(eventType: E, listener: EventHandler<EventsMap, This>[E]): number {
		return this.listeners[eventType].push(listener) - 1;
	}
	// Удаляет слушателя по индексу
	public removeEventListener<E extends keyof EventsMap>(eventType: E, listener: number) {
		delete(this.listeners[eventType][listener]);
	}
	protected dispatchEvent<E extends keyof EventsMap>(eventType: E, event: EventsMap[E]) {
		this.listeners[eventType].forEach(listener => listener.call(this as unknown as This, event));
	}
}

export interface Tagable {
	readonly time: number;
}

export class PriorityQueue<T extends Tagable>{

	list: Array<T>;

	get size() { return this.list.length; };

	constructor() {
		this.list = new Array<T>();
	}

	Add(body: T) {
		this.list.push(body);
		this.Up(this.list.length-1);
	}

	private Up(i: number) {
		let prev = this.Prev(i);
		while (i > 0 && this.list[i].time < this.list[prev].time) {
			this.Swap(i, prev);
			i = prev;
			prev = this.Prev(i);
		}
	}

	private Left(i: number): number {
		return 2 * i + 1;
	}

	private Right(i: number): number {
		return 2 * i + 2;
	}

	private Prev(i: number): number {
		return Math.floor((i - 1) / 2);
	}

	private Valid(i: number): boolean {
		return i < this.list.length;
	}

	clear() {
		this.list = new Array<T>();
	}

	enqueue(): T {
		if (this.list.length == 1) {
			return this.list.pop()!;
		}
		this.Swap(0, this.list.length - 1);
		const item = this.list.pop()!;
		this.Heapify(0);
		return item;
	}

	private Swap(i: number, j: number) {
		let buf = this.list[i];
		this.list[i] = this.list[j];
		this.list[j] = buf;
	}

	private Heapify(i: number) {
		if (!this.Valid(i))
			return;

		let min = i;
		let left = this.Left(i);
		let right = this.Right(i);

		if (this.Valid(left) && this.list[left].time < this.list[min].time)
			min = left;
		if (this.Valid(right) && this.list[right].time < this.list[min].time)
			min = right;
		if (min == i)
			return;

		this.Swap(i, min);
		this.Heapify(min);
	}

	Better() {
		return this.list[0];
	}

}

export class RingBuffer {
	private buffer: Array<number>;
	private end = 0;
	sum = 0

	public get avg() {
		return this.sum / this.capacity;
	}
	private get first() {
		return this.inc(this.end, 1);
	}

	get capacity() {
		return this.buffer.length;
	}

	put(elem: number) {
		this.sum -= this.buffer[this.end]
		this.sum += this.buffer[this.end] = elem;
		this.end = this.first;
	}

	forEach(action: (elem: number) => void) {
		if (this.buffer[this.end]) {
			for (let i = this.first; i != this.end; i = this.inc(i, 1))
				action(this.buffer[i]);
			action(this.buffer[this.end]);
			return
		}
		for (let i = 0; i != this.end; ++i)
			action(this.buffer[i]);
	}

	private inc(a: number, d = 1) {
		return (a + d) % this.capacity;
	}

	constructor(size: number) {
		this.buffer = new Array<number>(size);
		this.buffer.fill(0);
	}
}
