export function getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
	if (nullable) {
		return nullable;
	}
	return default_;
}

export type MapOfArrays<T> = {
	[K in keyof T]: T[K][]
}

export type EventHandler<T, This = unknown> = {
	[K in keyof T]: (this: This, data: T[K]) => void
}

type ListenersMap<EventsMap, This = unknown> = MapOfArrays<EventHandler<EventsMap, This>>;

export class Observable<EventsMap> {
	protected listeners: ListenersMap<EventsMap, this> = new Proxy<ListenersMap<EventsMap, this>>({} as ListenersMap<EventsMap, this>, {
		get: (map, propertyName, receiver) => {
			let property = Reflect.get(map, propertyName, receiver);
			if(property !== undefined)
				return property;
			property = [];
			Reflect.set(map, propertyName, property, receiver);
			return property;
		}
	});
	public addEventListener<E extends keyof EventsMap>(eventType: E, listener: EventHandler<EventsMap, this>[E]) {
		this.listeners[eventType].push(listener);
	}
	protected dispatchEvent<E extends keyof EventsMap>(eventType: E, event: EventsMap[E]) {
		this.listeners[eventType].forEach(listener => listener.call(this, event));
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

