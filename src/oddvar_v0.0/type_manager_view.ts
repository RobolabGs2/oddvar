import { Iterators } from "./iterator";
import * as HTML from "./html";
import { TypeManager, DeadlyRecipe, ClassDescription, FunctionDescription, getOrDefault, FieldDescription } from "./parser";
import "type_manager_view.scss";


export function hideChildOf<K extends keyof HTMLElementTagNameMap>(tagName: K) {
	return (ev: MouseEvent) => {
		const target = ev.target as HTMLElement;
		if (ev.button === 0 && target.tagName.toLowerCase() === tagName.toLowerCase()) {
			const className = "hideChilds";
			if (target.classList.contains(className))
				target.classList.remove(className);
			else
				target.classList.add(className);
		}
	}
};

export class TypeManagerView {
	constructor(public readonly types: TypeManager) { }

	FactoryListView(click: (json: DeadlyRecipe) => void): HTMLElement {

		const current = HTML.CreateElement(
			"div",
			HTML.SetStyles(styles => styles.width = "250px")
		);
		document.body.appendChild(current);
		const invokeClickEvent = (factory: ClassDescription, method: FunctionDescription, mouseEvent: MouseEvent) => {
			if (mouseEvent.button === 0) {
				if (current.firstChild) {
					current.removeChild(current.firstChild);
				}
				const [elem, output] = this.MethodView(method);
				const type = method.returnType;
				const nameInput = HTML.CreateElement(
					"input",
					HTML.SetRequired(),
					(input) => input.value = `${type}${getOrDefault(this.types.json.get(type)?.size, 0)}`
				);
				current.appendChild(
					HTML.CreateElement(
						"form",
						HTML.Append(
							nameInput,
							elem,
							HTML.CreateElement("input", HTML.SetInputType("submit"))
						),
						HTML.AddEventListener("submit", (ev: Event) => {
							ev.preventDefault();
							click(this.types.createDeadly(nameInput.value, type, factory.name, method, output));
							invokeClickEvent(factory, method, mouseEvent);
						})
					)
				);
			}
		};
		const methodPrefix = "Create";
		return HTML.CreateElement(
			"ul",
			HTML.SetStyles(style => style.cursor = "pointer"),
			HTML.AddEventListener("click", hideChildOf("li")),
			HTML.Append(
				Iterators.Wrap(this.types.factories.values()).
					map(
						factory => HTML.CreateElement(
							"li",
							HTML.SetText(factory.name, factory.documentation),
							HTML.Append(
								HTML.CreateElement("ul",
									HTML.Append(...factory.methods.
										filter(x => x.name.startsWith(methodPrefix)).
										map(
											method => HTML.CreateElement(
												"li",
												HTML.SetText(method.returnType, method.documentation),
												HTML.AddEventListener("click", invokeClickEvent.bind(null, factory, method))
											)
										)
									)
								)
							)
						)
					)
			)
		);
	}

	MethodView(method: FunctionDescription): [HTMLElement, Map<string, any>] {
		const output = new Map<string, any>();
		return [HTML.CreateElement(
			"article",
			HTML.Append(
				HTML.CreateElement("header", HTML.SetText(method.returnType, method.documentation)),
				HTML.CreateElement(
					"ul",
					HTML.Append(method.parameters.map(param => this.ParameterInput(output, param)))
				)
			)), output];
	}

	ParameterInput = (output: Map<string, any>, param: FieldDescription) => {
		return HTML.CreateElement("li",
			HTML.SetText(param.name, param.type),
			HTML.Append(
				this.TypeInput(param.name, param.type, output)
			));
	};
	TypeInput(name: string, type: string, output: Map<string, any>, required = true): HTMLElement {
		const additionalModifiers = (type: string) => {
			switch (type) {
				case "number":
					return [
						HTML.SetInputType("number"),
						HTML.SetNumberInputRange(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0.5)
					];
				case "boolean":
					return [HTML.SetRequired(false), HTML.SetInputType("checkbox")];
				// TODO
				// case "color":
				// 	return [SetInputType("color")]
				default:
					return [];
			}
		};
		const getValue = (input: HTMLInputElement) => {
			switch (input.type) {
				case "number": return input.valueAsNumber;
				case "radio":
				case "checkbox": return input.checked;
				default: return input.value;
			}
		};
		return this.types.switchByType(type, {
			nullable: (type) => this.TypeInput(name, type, output, false),
			class: (clazz) => {
				const classOutput = new Map<string, any>();
				output.set(name, classOutput);
				return HTML.CreateElement("ul",
					HTML.Append(clazz.consturctors[0].parameters.map(params => this.ParameterInput(classOutput, params)))
				);
			},
			deadly: (type) => {
				return HTML.CreateElement(
					"select",
					HTML.SetRequired(required),
					HTML.AddEventListener("change", function (ev) {
						const select = this as HTMLSelectElement;
						output.set(name, select.value);
					}),
					HTML.Append(
						Iterators.Wrap(this.types.getDeadlies(type.name)).map(t => HTML.CreateElement(
							"option",
							(option) => {
								option.value = t.name;
								option.text = t.name;
							}
						)
						).toArray()
					),
					(select) => select.dispatchEvent(new Event("change"))
				);
			},
			interface: (interf) => {
				const newMap = new Map<string, any>();
				output.set(name, newMap);
				return HTML.CreateElement("ul",
					HTML.Append(interf.fields.map(x => this.ParameterInput(newMap, x)))
				);
			},
			primitive: (type) => {
				return HTML.CreateElement(
					"input",
					HTML.SetTitle(type),
					HTML.SetRequired(required),
					HTML.SetName(name),
					HTML.AddEventListener("change", function (ev: Event) {
						output.set(name, getValue(this as HTMLInputElement));
					}),
					...additionalModifiers(type));
			}
		});
	}
}
