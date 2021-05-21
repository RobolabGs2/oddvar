/* DSL-like helpers for generating html */
export namespace HTML {
	export function CreateElement<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		...modify: ((t: HTMLElementTagNameMap[K]) => void)[]): HTMLElementTagNameMap[K] {
		return ModifyElement(document.createElement(tagName), ...modify);
	}

	export function ModifyElement<T extends HTMLElement>(
		tag: T,
		...modify: ((t: T) => void)[]): T {
		modify.forEach(x => x(tag));
		return tag;
	}

	export function SetTitle(title: string) {
		return (elem: HTMLElement) => elem.title = title;
	}

	export function SetId(id: string) {
		return (elem: HTMLElement) => elem.id = id;
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

	export function SetChecked(checked = true) {
		return (input: HTMLInputElement) => input.checked = checked;
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

	export function FlexContainer(direction = "row", justifyContent = "", settings = { wrap: false }) {
		return SetStyles(style => {
			style.display = "flex";
			style.flexDirection = direction;
			style.justifyContent = justifyContent;
			style.flexWrap = settings.wrap ? "wrap" : "no-wrap"
		})
	}

	export function CreateSwitcher(currentState: () => boolean, changeState: (on: boolean) => void, titles: Record<"on" | "off", string>): HTMLButtonElement {
		const button = HTML.CreateElement("button", SetText(!currentState() ? titles.on : titles.off));
		const hide = () => {
			changeState(!currentState())
			button.innerText = !currentState() ? titles.on : titles.off;
		};
		return HTML.ModifyElement(button, AddEventListener("click", hide))
	}

	export function CreateSelector<T extends string>(defaultKey: T, options: Record<T, string>, onChange: (value: T) => void) {
		return HTML.CreateElement("select",
			HTML.AddEventListener("change", function () {
				try {
					onChange(<T>(<HTMLSelectElement>this).value)
				} catch (e) {
					alert(`${e}`)
				}
			}),
			HTML.Append(...Object.entries(options).map(([value, text]) => HTML.CreateElement("option", HTML.SetText(text as string), (el) => el.value = value))),
			el => {
				el.selectedIndex = Object.keys(options).findIndex(k => k === defaultKey);
				onChange(defaultKey);
			}
		)
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
						ev.target!.dispatchEvent(new MouseEvent("mousedown", {
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
								ev.target!.dispatchEvent(new MouseEvent("mousemove", {
									clientX: touch.clientX,
									clientY: touch.clientY,
									button: 0,
								}));
							}
						}
					});
					break;
				case "mouseup":
					el.addEventListener("touchend", function (ev) {
						ev.preventDefault();
						ev.target!.dispatchEvent(new MouseEvent("mouseup"));
					});
					break;
			}
		}
	}
	export namespace Input {
		export type Type =
			{ type: "int" | "float", default: number, min?: number, max?: number, description?: string }
			| ObjectType & { description?: string }
			| { type: "string", default: string, description?: string }
			| { type: "boolean", default: boolean, description?: string }
			| {
				type: "color", description?: string,
				/** только #RRGGBB в полной форме, слова не поддерживаются */
				default: string,
			}
			| {
				type: "enum", default: string, description?: string,
				/** Пары: название значения енума:отображаемое название в ui */
				values: Record<string, string>
			}
		export type ObjectType<T extends string = string> = { type: "object", values: Record<T, Type> }
		export function GetDefault<T extends string>(type: ObjectType<T>): Record<T, any> {
			const res = {} as { "": Record<T, any> };
			CreateTypedInput("", type, res);
			return res[""];
		}
		/** output - в этот объект будут попадать значения по мере заполнения полей инпута */
		export function CreateTypedInput(name: string, type: Type, output: Record<string, any>, required = true): HTMLElement {
			if (type.type !== "object") {
				output[name] = type.default;
			}
			switch (type.type) {
				case "boolean":
				case "string":
				case "int":
				case "float":
				case "color":
					return CreateElement("input",
						SetName(name),
						SetTitle(type.description || name),
						SetRequired(required),
						AddEventListener("change", function (ev: Event) {
							output[name] = getValue(this as HTMLInputElement);
						}),
						...additionalModifiers(type), setValue.bind(null, type));
				case "enum":
					return HTML.ModifyElement(CreateSelector(type.default, type.values, value => output[name] = value), SetTitle(type.description || name));
				case "object":
					const innerOutput = output[name] = {};
					return CreateElement("ul", Append(
						Object.entries(type.values).
							map(([name, type]) => CreateElement("li", Append(
								CreateElement("span", SetText(name, type.description || name)),
								CreateTypedInput(name, type, innerOutput))))
					));
			}
		}
		function additionalModifiers(type: Type) {
			switch (type.type) {
				case "float":
					return [
						SetInputType("number"),
						SetNumberInputRange(or(type.min, Number.MIN_SAFE_INTEGER), or(type.max, Number.MAX_SAFE_INTEGER), 0.0001)
					];
				case "int":
					return [
						SetInputType("number"),
						SetNumberInputRange(or(type.min, Number.MIN_SAFE_INTEGER), or(type.max, Number.MAX_SAFE_INTEGER), 1)
					];
				case "boolean":
					return [HTML.SetRequired(false), HTML.SetInputType("checkbox")];
				case "color":
					return [SetInputType("color")]
			}
			return [];
		}
		function getValue(input: HTMLInputElement) {
			switch (input.type) {
				case "number": return input.valueAsNumber;
				case "radio":
				case "checkbox": return input.checked;
				default: return input.value;
			}
		}
		function setValue(type: Type, input: HTMLInputElement) {
			switch (type.type) {
				case "int":
				case "float":
					input.valueAsNumber = type.default;
					return;
				case "color":
				case "string":
					input.value = type.default;
					return;
				case "boolean":
					input.checked = type.default;
					return
			}
		}
	}
}

function sqr(x: number) { return x * x }
function distanceSquare(x1: number, y1: number, x2: number, y2: number) {
	return sqr(x1 - x2) + sqr(y1 - y2);
}
function or<T>(x: T | undefined, y: T): T {
	return x === undefined ? y : x;
}