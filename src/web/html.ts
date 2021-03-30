/* DSL-like helpers for generating html */
export namespace HTML {
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

	export function SetNumberInputRange(min: number | undefined, max: number | undefined, step: number | undefined) {
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
		return (el: HTMLElement) => {
			el.addEventListener(type, listener, options)
			switch (type) {
				case "mousedown":
					el.addEventListener("touchstart", function (ev) {
						ev.preventDefault();
						const touch = ev.touches.item(0)!;
						(<((this: HTMLElement, ev: HTMLElementEventMap["mousedown"]) => any)>listener).
							call(this, new MouseEvent("mousedown", {
								clientX: touch.clientX,
								clientY: touch.clientY,
								button: 0,
							}));
					});
					break;
				case "mousemove":
					el.addEventListener("touchmove", function (ev) {
						ev.preventDefault();
						const touches = ev.touches;
						const rect = this.getBoundingClientRect();
						const centerX = rect.left + rect.width / 2
						const centerY = rect.top + rect.height / 2;
						const distanceFromCenter = distanceSquare.bind(undefined, centerX, centerY);
						const r_2 = sqr(Math.max(rect.height, rect.width));
						for (let i = 0; i < touches.length; i++) {
							const touch = ev.touches.item(i)!;
							if (distanceFromCenter(touch.clientX, touch.clientY) < r_2) {
								(<((this: HTMLElement, ev: HTMLElementEventMap["mousemove"]) => any)>listener).
									call(this, new MouseEvent("mousemove", {
										clientX: touch.clientX,
										clientY: touch.clientY,
										button: 0,
									}));
								return
							}
						}
					});
					break;
				case "mouseup":
					el.addEventListener("touchend", function (ev) {
						ev.preventDefault();
						(<((this: HTMLElement, ev: HTMLElementEventMap["mouseup"]) => any)>listener).
							call(this, new MouseEvent("mouseup"));
					});
					break;
			}
		}
	}

}

function sqr(x: number) { return x * x }
function distanceSquare(x1: number, y1: number, x2: number, y2: number) {
	return sqr(x1-x2)+sqr(y1-y2);
}