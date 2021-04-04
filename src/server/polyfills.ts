// Добавляем вещи, которые есть в браузере, но не всегда есть в ноде
export {};

if (Object.fromEntries === undefined) {
	Object.fromEntries = function <T = any>(entries: Iterable<readonly [PropertyKey, T]>): { [k: string]: T }{
		const res: {[k:string]: T} = {};
		for (let pair of entries) {
			res[pair[0] as string] = pair[1]
		}
		return res;
	}
}