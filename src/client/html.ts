/* DSL-like helpers for generating html */

export function CreateElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	...modify: ((t: HTMLElementTagNameMap[K]) => void)[]): HTMLElementTagNameMap[K] {
	const elem = document.createElement(tagName);
	modify.forEach(x => x(elem));
	return elem;
}

export function SetTitle(title: string) {
	return (elem: HTMLElement) => elem.title = title;
}

export function AddClass(className: string) {
	return (elem: HTMLElement) => elem.classList.add(className);
}

export function SetName(name: string) {
	return (input: HTMLInputElement) => input.name = name;
}

export function SetRequired(required = true) {
	return (input: HTMLInputElement | HTMLSelectElement) => input.required = required;
}

export function SetInputType(type: string) {
	return (input: HTMLInputElement) => input.type = type;
}

export function SetNumberInputRange(min: number|undefined, max: number|undefined, step: number|undefined) {
	return (input: HTMLInputElement) => {
		input.min = min === undefined ? "any" : min.toString();
		input.max = max === undefined ? "any" : max.toString();
		input.step = step === undefined ? "any" : step.toString();
	}
}

export function SetText(text: string, title?: string) {
	return (el: HTMLElement) => {
		el.textContent = text;
		if (title)
			el.title = title;
	}
}

export function SetStyles(setter: (styles: CSSStyleDeclaration) => void) {
	return (el: HTMLElement) => setter(el.style);
}

interface ForEachable<T> {
	forEach(each: (value: T) => void): void;
}

export function Append<T extends HTMLElement>(...elems: T[]): (parent: HTMLElement) => void
export function Append<T extends HTMLElement>(elems: ForEachable<T>): (parent: HTMLElement) => void
export function Append<T extends HTMLElement>(...elems: (ForEachable<T> | HTMLElement)[]): (parent: HTMLElement) => void
export function Append<T extends HTMLElement>(...elems: (ForEachable<T> | HTMLElement)[]): (parent: HTMLElement) => void {
	return (parent: HTMLElement) =>
		elems.forEach(value => {
			if (value instanceof HTMLElement) {
				parent.append(value);
			} else {
				value.forEach(elem => parent.append(elem));
			}
		})
}

export function AddEventListener<K extends keyof HTMLElementEventMap>(
	type: K,
	listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions
) {
	return (el: HTMLElement) => el.addEventListener(type, listener, options)
}

