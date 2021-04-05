import { Iterators } from "./iterator";

function fixedSize(i: number): string {
	return `${i} `.substr(0, 2);
}

export namespace PrettyPrint {

	export function matrix<T>(from: T[][], valueMapper: (x: T) => string = (x) => `${x}`): string {
		return [`   ${Iterators.Range(from[0].length).map((i) => fixedSize(i)).join(" ")}`].
			concat(from.map((line, i) => `${fixedSize(i)} ${line.map(valueMapper).join("  ")}`)).join("\n");
	}
}
