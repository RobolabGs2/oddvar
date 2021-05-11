export namespace Enums {
	function isString(value: any): value is string {
		return typeof value === "string";
	}

	export type Object<Enum> = Record<string, string | Enum>;

	export function forEach<Enum>(e: Object<Enum>, action: (value: Enum, name: string) => void) {
		names(e).forEach((name) => action(e[name] as Enum, name));
	}
	export function names(e: Object<unknown>): string[] {
		return Object.values(e).filter(isString);
	}
	export function values<Enum>(e: Object<Enum>): Enum[] {
		return names(e).map(x => e[x] as Enum);
	}
	export function entries<Enum>(e: Object<Enum>): [Enum, string][] {
		return names(e).map(x => [e[x] as Enum, x]);
	}
	export function count<Enum>(e: Object<Enum>): number {
		return names(e).length;
	}
}
