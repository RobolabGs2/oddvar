import { Deadly } from "base";
import { Iterators } from "iterator";
import "parser.scss";

function applyToConstructor(constructor: Function, argArray: any[]) {
	var args = [null].concat(argArray) as any;
	var factoryFunction = constructor.bind.apply(constructor, args);
	return new factoryFunction();
}

export class Parser {
	private primitives: Map<string, Function>;
	private factories: Map<string, any>;
	public constructor(factories: object[], primitives: any[], private creatorPrefix = "Create") {
		this.factories = new Map(factories.map(v => [v.constructor.name.toLowerCase(), v]));
		this.primitives = new Map(primitives.map(v => v.prototype.constructor).map(value => [value.name, value]));
	}
	parseWorld(jsonWorld: string) {
		let json = JSON.parse(jsonWorld, (key: string, value: any) => {
			if (!value) {
				return value;
			}
			if (Array.isArray(value)) {
				const primitiveConstructor = this.primitives.get(key);
				if (primitiveConstructor)
					return applyToConstructor(primitiveConstructor, value);
			} else if (typeof (value) === "object") {
				const primitiveValue = Array.from(this.primitives.keys()).find(v => value[v]);
				if (primitiveValue)
					return value[primitiveValue]
			}
			return value;
		}) as [];
		json.forEach(element => {
			this.parseElement(element);
		});
	}

	private namedEntities = new Map<string, Deadly>();

	parseElement({ type, constructor, child, name }: ElementRecipe, parent?: any) {
		const [factoryName, constructorName] = type.split(".");
		const factory = this.factories.get(factoryName);
		if (!factory)
			throw new Error(`Unknown factory '${factoryName}' for ${type}!`);
		const constructorMethod = factory[`${this.creatorPrefix}${constructorName}`] as Function;
		if (!constructorMethod || !(constructorMethod instanceof Function))
			throw new Error(`Unknown factory method '${constructorMethod}' for ${type}!`);
		const elem = constructorMethod.call(
			factory,
			...(parent ?
				[parent, ...constructor]
				:
				constructor.map(param => (typeof param) === "string" && this.namedEntities.has(param) ? this.namedEntities.get(param) : param)));
		if (elem instanceof Deadly) {
			elem.Name = name ? name : `${type}${(Math.random() * 100000000).toFixed(0)}`
			if (name)
				this.namedEntities.set(elem.Name, elem)
		}
		child?.forEach(element => this.parseElement(element, elem));
	}

	newTypeManager(json: ReflectionJSON): TypeManager {
		const factories = new Map<string, ClassDescription>()
		const classes = new Map<string, ClassDescription>()
		json.classes.forEach(desc => (this.factories.has(desc.name.toLowerCase()) ? factories : classes).set(desc.name, desc));
		return new TypeManager(factories, classes, new Map(json.interfaces.map(desc => [desc.name, desc])));
	}

}

export interface ElementRecipe {
	type: string
	name?: string
	constructor: []
	child: []
}

type ConstructorArgument = string | number | object

interface DeadlyRecipe {
	type: string
	name?: string
	constructor: ConstructorArgument[]
	child?: DeadlyRecipe[]
}


export interface ReflectionJSON {
	classes: ClassDescription[];
	interfaces: InterfaceDescription[];
}

interface DocumentedDesctiption {
	readonly documentation: string;
}

interface NamedSymbolDesctiption extends DocumentedDesctiption {
	readonly name: string
}

interface SignatureDescription extends DocumentedDesctiption {
	readonly parameters: FieldDescription[];
	readonly returnType: string;
}

interface FunctionDescription extends SignatureDescription {
	readonly name: string
}

interface FieldDescription extends NamedSymbolDesctiption {
	readonly type: string;
}

interface InterfaceDescription extends NamedSymbolDesctiption {
	readonly fields: FieldDescription[];
	readonly methods: FunctionDescription[];
}

interface ClassDescription extends InterfaceDescription {
	readonly consturctors: SignatureDescription[];
	readonly prototype: string;
}

const hideChildOfLI = (ev: MouseEvent) => {
	const target = ev.target as HTMLElement;
	if (ev.button === 0 && target.tagName.toLowerCase() == "li") {
		const className = "hideChilds";
		if (target.classList.contains(className))
			target.classList.remove(className)
		else
			target.classList.add(className);
	}
}

export class TypeManager {
	private inheritanceTree = new Map<string, string>();
	private inheritanceLists = new Map<string, string[]>();
	constructor(
		public readonly factories: Map<string, ClassDescription>,
		public readonly classes: Map<string, ClassDescription>,
		public readonly interfaces: Map<string, InterfaceDescription>
	) {
		classes.forEach(desc => {
			if (desc.prototype) {
				this.inheritanceTree.set(desc.name, desc.prototype);
				for (let type: string | undefined = desc.prototype; type; type = this.inheritanceTree.get(type!)) {
					let siblings = this.inheritanceLists.get(type)
					if (siblings) {
						siblings.push(desc.name);
					} else {
						this.inheritanceLists.set(desc.prototype, [desc.name])
					}
				}
			}
		})
		console.log(this.inheritanceLists)
	}

	instanceOf(expected: string, actual: string): boolean {
		return expected === actual || this.inheritanceLists.get(expected)?.find(x => x === actual) === actual
	}
	// isChild(parent: string, child: string) {
	// 	let type: string|undefined = child
	// 	while(type && type != parent)
	// 		type = this.inheritanceTree.get(type!)
	// 	return type === parent;
	// }


	constructorParamFromMap(signature: SignatureDescription, map: Map<string, any>): ConstructorArgument[] {
		return signature.parameters.map(param => {
			const value = map.get(param.name);
			return this.switchByType<ConstructorArgument>(param.type, {
				nullable: (type) => value, // TODO it's work only nullable primitive
				primitive: (type) => value,
				class: (clazz) => {
					const classConstructor = value as Map<string, any>;
					const res = {} as any;
					res[clazz.name] = this.constructorParamFromMap(clazz.consturctors[0], classConstructor);
					return res as object;
				},
				deadly: (type) => "DEADLY",
				interface: (interf) => {
					const interfaceFields = value as Map<string, any>;
					// TODO: works only interface with primirive fields
					return Object.entries(interfaceFields.entries());
				},
			})
		});
	}

	FactoryListView(click: (ev: { factory: ClassDescription, method: FunctionDescription }) => void): HTMLElement {

		const current = createElement(
			"div",
			SetStyles(styles => styles.width = "250px"),
		)
		document.body.appendChild(current);
		const invokeClickEvent = (factory: ClassDescription, method: FunctionDescription, ev: MouseEvent) => {
			if (ev.button === 0) {
				click({ factory, method })
				if (current.firstChild) {
					current.removeChild(current.firstChild)
				}
				const [elem, output] = this.MethodView(method);
				current.appendChild(
					createElement(
						"form",
						AppendHTML(
							elem,
							createElement("input", SetInputType("submit"))
						),
						AddEventListener("submit", (ev: Event) => {
							ev.preventDefault();
							const deadly: DeadlyRecipe = {
								name: method.returnType,
								type: `${factory.name.toLowerCase()}.${method.returnType}`,
								constructor: this.constructorParamFromMap(method, output),
							}
							console.log(JSON.stringify(deadly, undefined, 4))
						})
					)
				)
			}
		}
		const methodPrefix = "Create";
		return createElement(
			"ul",
			SetStyles(style => style.cursor = "pointer"),
			AddEventListener("click", hideChildOfLI),
			AppendHTML(
				Iterators.Wrap(
					this.factories.values()
				).map(
					factory => createElement(
						"li",
						FillHTML(factory),
						AppendHTML(
							createElement("ul",
								AppendHTML(...factory.methods.
									filter(x => x.name.startsWith(methodPrefix)).
									map(
										method => createElement(
											"li",
											FillHTML({ name: method.name.slice(methodPrefix.length), documentation: method.documentation }),
											AddEventListener("click", invokeClickEvent.bind(null, factory, method))
										)
									)
								)
							)
						)
					)
				)
			)
		)
	}

	MethodView(method: FunctionDescription): [HTMLElement, Map<string, any>] {
		const parametrs = new Map<string, any>();
		return [createElement(
			"article",
			AppendHTML(
				createElement("header", FillHTML({ name: method.returnType, documentation: method.documentation })),
				createElement(
					"ul",
					AppendHTML(method.parameters.map(this.ParameterInput.bind(this, parametrs))),
					AddEventListener("click", hideChildOfLI),
				)
			)), parametrs]
	}

	ParameterInput = (output: Map<string, any>, param: FieldDescription) => {
		return createElement("li",
			FillHTML({ name: param.name, documentation: param.type }),
			AppendHTML(
				this.TypeInput(param.name, param.type, output),
			))
	}

	getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
		if (nullable) {
			return nullable;
		}
		return default_;
	}
	private readonly nullRegexp = /null|undefined/;

	switchByType<T>(type: string, actions: {
		nullable: (type: string) => T,
		interface: (desc: InterfaceDescription) => T,
		deadly: (desc: ClassDescription | string) => T,
		class: (desc: ClassDescription) => T,
		primitive: (type: string) => T,
	}): T {
		if (type.match(/\|/)) {
			const types = type.split(" | ");
			const mainType = types.filter(x => !x.match(this.nullRegexp));
			if (mainType.length != 1)
				throw new Error(`${type} is not supported now, only nullable union supported!`);
			return actions.nullable(mainType[0]);
		}
		if (this.interfaces.has(type)) {
			return actions.interface(this.interfaces.get(type)!);
		}
		if (this.instanceOf("Deadly", type))
			return actions.deadly(type);
		if (this.classes.has(type))
			return actions.class(this.classes.get(type)!);
		return actions.primitive(type);
	}
	TypeInput(name: string, type: string, output: Map<string, any>, required = true): HTMLElement {
		const additionalModifiers = (type: string) => {
			switch (type) {
				case "number":
					return [SetInputType("number")]
				case "boolean":
					return [SetRequired(false), SetInputType("checkbox")]
				// TODO
				// case "color":
				// 	return [SetInputType("color")]
				default:
					return []
			}
		}
		const getValue = (input: HTMLInputElement) => {
			switch (input.type) {
				case "number": return input.valueAsNumber;
				case "checkbox": return input.checked;
				default: return input.value;
			}
		}
		return this.switchByType(type, {
			nullable: (type) => this.TypeInput(name, type, output, false),
			class: (clazz) => {
				const newMap1 = new Map<string, any>();
				output.set(name, newMap1);
				return createElement("ul",
					AppendHTML(clazz.consturctors[0].parameters.map(this.ParameterInput.bind(this, newMap1))),
				)
			},
			deadly: (type) => {
				return createElement(
					"ul",
					CSSClass("unsupported"),
					AppendHTML(
						[type as string].concat(this.getOrDefault(this.inheritanceLists.get(type as string), [])).
							map(x => createElement("li", (li => li.textContent = x)))
					)
				)
			},
			interface: (interf) => {
				const newMap = new Map<string, any>();
				output.set(name, newMap);
				return createElement("ul",
					AppendHTML(interf.fields.map(this.ParameterInput.bind(this, newMap))),
				)
			},
			primitive: (type) => {
				return createElement(
					"input",
					SetTitle(type),
					SetRequired(required),
					SetName(name),
					AddEventListener("change", function (ev: Event) {
						output.set(name, getValue(this as HTMLInputElement))
					}),
					...additionalModifiers(type));
			}
		});
	}
}

function SetTitle(title: string) {
	return (elem: HTMLElement) => elem.title = title;
}

function CSSClass(className: string) {
	return (elem: HTMLElement) => elem.classList.add(className);
}


function SetName(name: string) {
	return (input: HTMLInputElement) => input.name = name;
}

function SetRequired(required = true) {
	return (input: HTMLInputElement) => input.required = required;
}

function SetInputType(type: string) {
	return (input: HTMLInputElement) => input.type = type;
}

function FillHTML({ name, documentation }: NamedSymbolDesctiption) {
	return (el: HTMLElement) => {
		el.textContent = name;
		el.title = documentation;
	}
}

function SetStyles(setter: (styles: CSSStyleDeclaration) => void) {
	return (el: HTMLElement) => setter(el.style);
}

interface ForEachable<T> {
	forEach(each: (value: T) => void): void;
}

function AppendHTML(...elems: HTMLElement[]): (parent: HTMLElement) => void
function AppendHTML(elems: ForEachable<HTMLElement>): (parent: HTMLElement) => void
function AppendHTML(...elems: (ForEachable<HTMLElement> | HTMLElement)[]): (parent: HTMLElement) => void
function AppendHTML(...elems: (ForEachable<HTMLElement> | HTMLElement)[]): (parent: HTMLElement) => void {
	return (parent: HTMLElement) =>
		elems.forEach(value => {
			if (value instanceof HTMLElement) {
				parent.append(value);
			} else {
				value.forEach(elem => parent.append(elem));
			}
		})
}

function AddEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) {
	return (el: HTMLElement) => {
		el.addEventListener(type, listener, options)
	}
}

function createElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	...modify: ((t: HTMLElementTagNameMap[K]) => void)[]): HTMLElementTagNameMap[K] {
	const elem = document.createElement(tagName);
	modify.forEach(x => x(elem))
	return elem;
}
