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
		return expected===actual || this.inheritanceLists.get(expected)?.find(x=>x===actual) === actual
	}
	// isChild(parent: string, child: string) {
	// 	let type: string|undefined = child
	// 	while(type && type != parent)
	// 		type = this.inheritanceTree.get(type!)
	// 	return type === parent;
	// }

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
				current.appendChild(this.MethodView(method))
			}
		}
		const methodPrefix = "Create";
		return createElement(
			"ul",
			SetStyles(style => style.cursor = "pointer"),
			AddEventListener("click", hideChildOfLI),
			AppendHTML(
				createElement("style",
					style => style.textContent = `input {width: 32px;}`),
				Iterators.Wrap(
					this.factories.values()
				).map(
					factory => createElement(
						"li",
						FillHTML(factory),
						// AddEventListener("click", hideChild),
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

	MethodView(method: FunctionDescription): HTMLElement {
		return createElement(
			"article",
			AppendHTML(
				createElement("header", FillHTML({ name: method.returnType, documentation: method.documentation })),
				createElement(
					"ul",
					AppendHTML(method.parameters.map(this.ParameterInput)),
					AddEventListener("click", hideChildOfLI),
				)
			))
	}

	ParameterInput = (param: FieldDescription) => {
		return createElement("li",
			FillHTML({ name: param.name, documentation: param.documentation }),
			AppendHTML(
				this.TypeInput(param.type),
			))
	}

	getOrDefault<T>(nullable: T|null|undefined, default_: T): T {
		if(nullable) {
			return nullable;
		}
		return default_;
	}

	TypeInput(type: string): HTMLElement {
		if (this.interfaces.has(type)) {
			const interf = this.interfaces.get(type)!;
			return createElement("ul",
				AppendHTML(interf.fields.map(this.ParameterInput)),
			)
		}
		if(this.instanceOf("Deadly", type))
			return createElement(
				"ul",
				AppendHTML([type].concat(this.getOrDefault(this.inheritanceLists.get(type), [])).map(x=>createElement("li", (li=>li.textContent=x))))
			)
		if (this.classes.has(type)) {
			const clazz = this.classes.get(type)!;
			return createElement("ul",
				AppendHTML(clazz.consturctors[0].parameters.map(this.ParameterInput)),
			)
		}
		switch (type) {
			case "string":
				return createElement("input")
			case "number":
				return createElement("input", SetInputType("number"))
			case "boolean":
				return createElement("input", SetInputType("checkbox"))
			default:
				return createElement("a")
		}
	}

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
