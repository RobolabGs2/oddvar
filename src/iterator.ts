export namespace Iterators {

	export class Wrapper<T> {
		constructor(public readonly iterator: IterableIterator<T>) {
		}
		map<U>(mapper: (x: T)=>U) {
			return new Wrapper(map(this.iterator, mapper))
		}
		filter(predicat: (x: T) => boolean) {
			return new Wrapper(filter(this.iterator, predicat))
		}
		toArray() {
			return Array.from(this.iterator);
		}
		forEach(action: (value: T, index: number) => void) {
			forEach(this.iterator, action);
		}
	}
	export function Wrap<T>(iterator: IterableIterator<T>) {
		return new Wrapper(iterator);
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