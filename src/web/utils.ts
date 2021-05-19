import { HTML } from "./html";

export function GetStyleSheet(): Promise<CSSStyleSheet> {
	return new Promise((resolve, reject) => {
		document.head.appendChild(HTML.CreateElement("style",
			(style: HTMLStyleElement) => {
				setTimeout(() => {
					const styleSheet = style.sheet;
					if (!styleSheet) {
						reject(new Error("Can't take style sheet"));
						return
					}
					styleSheet.addRule(`*`, `margin: 0; padding: 0;`);
					resolve(styleSheet);
				});
			}))
	})
}

export interface Holder<T> {
	has(item: T): boolean
}

export type MapOfSets<T> = {
	[K in keyof T]: Holder<T[K]>
}

export function URIStorage<T extends object>(defaults: T, constraints: MapOfSets<T>): T {
	function getURL() {
		return new URL(location.href);
	}
	const keys = Object.keys(constraints);
	const res = new Proxy<T>(Object.create(null), {
		get: (_, field) => {
			if (typeof field !== "string")
				return;
			if (field === "toJSON") {
				return () => keys.reduce((acc, key) => {
					acc[key] = res[<keyof T>key];
					return acc;
				}, {} as Record<string, any>);
			}
			const constraint = constraints[<keyof T>field];
			if (constraint === undefined)
				return;
			const url = getURL();
			const value = (url.searchParams.get(field) || "");
			if (constraint.has(<any>value)) return value;
			const defaultValue = defaults[<keyof T>field];
			url.searchParams.set(field, `${defaultValue}`);
			history.pushState(null, "", url.toString());
			return defaultValue;
		},
		set: (_, field, value) => {
			if (typeof field !== "string")
				return false;
			const url = getURL();
			if (url.searchParams.get(field) === value)
				return true;
			url.searchParams.set(field, value);
			history.pushState(null, "", url.toString());
			return true;
		}
	})
	return res;
}