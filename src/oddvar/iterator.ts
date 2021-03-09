export namespace Iterators {
	export interface Wrapper<T> {
		map<U>(mapper: (x: T)=>U): Wrapper<U>
		filter(predicat: (x: T) => boolean): Wrapper<T>
		toArray(): T[]
		forEach(action: (value: T, index: number) => void): void
	}
	export class IteratorWrapper<T> implements Wrapper<T>{
		constructor(public readonly iterator: IterableIterator<T>) {
		}
		map<U>(mapper: (x: T)=>U) {
			return new IteratorWrapper(map(this.iterator, mapper))
		}
		filter(predicat: (x: T) => boolean) {
			return new IteratorWrapper(filter(this.iterator, predicat))
		}
		toArray() {
			return Array.from(this.iterator);
		}
		forEach(action: (value: T, index: number) => void) {
			forEach(this.iterator, action);
		}
	}

	class NullWrapper<T> implements Wrapper<T> {
		map<U>(mapper: (x: T) => U): Wrapper<U> {
			return this as unknown as Wrapper<U>;
		}
		filter(predicate: (x: T) => boolean): Wrapper<T> {
			return this;
		}
		toArray(): T[] {
			return [];
		}
		forEach(action: (value: T, index: number) => void): void{}
	}

	export function Wrap<T>(iterator: IterableIterator<T>): Wrapper<T> {
		return new IteratorWrapper(iterator);
	}
	export function WrapOrNoting<T>(iterator?: IterableIterator<T>): Wrapper<T> {
		if(iterator)
			return Wrap(iterator);
		return new NullWrapper;
	}
	export function* map<V, T>(iter: IterableIterator<V>, map: (value: V) => T) {
		for (let i of iter)
			yield map(i);
	}

	export function* filter<V>(iter: IterableIterator<V>, filter: (value: V) => boolean) {
		for (let i of iter)
			if (filter(i)) 
				yield i;
	}
	export function forEach<V>(iter: IterableIterator<V>, action: (value: V, index: number) => void) {
		let i = 0;
		for (let value of iter)
			action(value, i++);
	}
}