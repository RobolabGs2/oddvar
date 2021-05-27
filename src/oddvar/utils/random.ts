export namespace Random {
	export function Elem<T>(elems: T[]): T {
		return elems[(Math.random() * elems.length) | 0];
	}
	export function Int(min = Number.MIN_SAFE_INTEGER/3, max = Number.MAX_SAFE_INTEGER/3): number {
		return (Math.random()*(max-min)+min)|0;
	}
}