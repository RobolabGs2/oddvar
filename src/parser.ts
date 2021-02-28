import { Deadly } from "base";
import { Iterators } from "iterator";
import "parser.scss";
import * as HTML from "html";

function applyToConstructor(constructor: Function, argArray: any[]) {
	const args = [null].concat(argArray) as any;
	const factoryFunction = constructor.bind.apply(constructor, args);
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
		}) as DeadlyRecipe[];
		json.forEach(element => {
			this.parseElement(element);
		});
	}

	private namedEntities = new Map<string, Deadly>();

	parseElement({ type, constructor, child, name }: DeadlyRecipe, parent?: any) {
		const [factoryName, constructorName] = type.split(".");
		const factory = this.factories.get(factoryName);
		if (!factory)
			throw new Error(`Unknown factory '${factoryName}' for ${type}!`);
		const constructorMethod = factory[`${this.creatorPrefix}${constructorName}`] as Function | undefined;
		if (!constructorMethod || !(constructorMethod instanceof Function))
			throw new Error(`Unknown factory method '${constructorMethod}' for ${type}!`);
		const elem = constructorMethod.call(
			factory,
			...(parent ?
				[parent, ...constructor]
				:
				constructor.map(param => (typeof param) === "string" && this.namedEntities.has(param as string) ? this.namedEntities.get(param as string) : param)));
		if (elem instanceof Deadly) {
			elem.Name = name ? name : `${type}${(Math.random() * 100000000).toFixed(0)}`;
			if (name)
				this.namedEntities.set(elem.Name, elem)
		}
		child?.forEach(element => this.parseElement(element, elem));
	}

	newTypeManager(json: ReflectionJSON): TypeManager {
		const factories = new Map<string, ClassDescription>();
		const classes = new Map<string, ClassDescription>();
		json.classes.forEach(desc => (this.factories.has(desc.name.toLowerCase()) ? factories : classes).set(desc.name, desc));
		return new TypeManager(factories, classes, new Map(json.interfaces.map(desc => [desc.name, desc])));
	}

}

type ConstructorArgument = string | number | object

interface DeadlyRecipe {
	type: string
	name: string
	constructor: ConstructorArgument[]
	child: DeadlyRecipe[]
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

function IsImplements(classDesc: ClassDescription, interfaceDesc: InterfaceDescription): boolean {
	// TODO fix
	if (interfaceDesc.name.endsWith("Listener"))
		return false;
	return interfaceDesc.methods.
		every(interfaceMethod => classDesc.methods.find(classMethod => FunctionsAreEquals(interfaceMethod, classMethod)))
		&&
		interfaceDesc.fields.every(interfaceField => classDesc.fields.find(classField => classField.name === interfaceField.name && classField.type === interfaceField.type))
}

function FunctionsAreEquals(desc1: FunctionDescription, desc2: FunctionDescription): boolean {
	if (desc1.name !== desc2.name || desc1.returnType != desc2.returnType || desc1.parameters.length != desc2.parameters.length)
		return false;
	return desc1.parameters.every((param, i) => param.type === desc2.parameters[i].type);
}

const hideChildOfLI = (ev: MouseEvent) => {
	const target = ev.target as HTMLElement;
	if (ev.button === 0 && target.tagName.toLowerCase() == "li") {
		const className = "hideChilds";
		if (target.classList.contains(className))
			target.classList.remove(className);
		else
			target.classList.add(className);
	}
};

export class TypeManager {
	private inheritanceTree = new Map<string, string>();
	private inheritanceLists = new Map<string, string[]>();
	private implementationsLists: Map<string, string[]>;
	constructor(
		public readonly factories: Map<string, ClassDescription>,
		public readonly classes: Map<string, ClassDescription>,
		public readonly interfaces: Map<string, InterfaceDescription>
	) {
		classes.forEach(desc => {
			if (desc.prototype) {
				this.inheritanceTree.set(desc.name, desc.prototype);
				for (let type: string | undefined = desc.prototype; type; type = this.inheritanceTree.get(type!)) {
					let siblings = this.inheritanceLists.get(type);
					if (siblings) {
						siblings.push(desc.name);
					} else {
						this.inheritanceLists.set(desc.prototype, [desc.name])
					}
				}
			}
		});
		this.implementationsLists = new Map<string, string[]>(
			Iterators.Wrap(interfaces.values()).
				map(desc => [
					desc.name,
					Iterators.Wrap(classes.values()).filter(classDesc => IsImplements(classDesc, desc)).map(d => d.name).toArray()] as [string, string[]]).toArray()
		);
		console.log(this.inheritanceLists)
		console.log(this.implementationsLists)
	}

	instanceOf(expected: string, actual: string): boolean {
		return expected === actual || this.inheritanceLists.get(expected)?.find(x => x === actual) === actual
	}

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
				deadly: (type) => value,
				interface: (interf) => {
					const interfaceFields = value as Map<string, any>;
					// TODO: works only interface with primirive fields
					return Array.from(interfaceFields.entries()).reduce((cap, cur) => { cap[cur[0]] = cur[1]; return cap }, {} as any);
				},
			})
		});
	}

	FactoryListView(click: (json: DeadlyRecipe) => void): HTMLElement {

		const current = HTML.CreateElement(
			"div",
			HTML.SetStyles(styles => styles.width = "250px"),
		);
		document.body.appendChild(current);
		const invokeClickEvent = (factory: ClassDescription, method: FunctionDescription, mouseEvent: MouseEvent) => {
			if (mouseEvent.button === 0) {
				if (current.firstChild) {
					current.removeChild(current.firstChild)
				}
				const [elem, output] = this.MethodView(method);
				const type = method.returnType;
				const nameInput = HTML.CreateElement(
					"input",
					HTML.SetRequired(),
					(input) => input.value = `${type}${this.getOrDefault(this.json.get(type)?.size, 0)}`
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
							const deadly: DeadlyRecipe = {
								name: nameInput.value,
								type: `${factory.name.toLowerCase()}.${type}`,
								constructor: this.constructorParamFromMap(method, output),
								child: [],
							};
							let deadlies = this.json.get(type);
							if (!deadlies) {
								deadlies = new Map<string, DeadlyRecipe>();
								this.json.set(type, deadlies);
							}
							deadlies.set(deadly.name, deadly);
							click(deadly);
							invokeClickEvent(factory, method, mouseEvent);
						})
					)
				)
			}
		};
		const methodPrefix = "Create";
		return HTML.CreateElement(
			"ul",
			HTML.SetStyles(style => style.cursor = "pointer"),
			HTML.AddEventListener("click", hideChildOfLI),
			HTML.Append(
				Iterators.Wrap(
					this.factories.values()
				).map(
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
		)
	}

	MethodView(method: FunctionDescription): [HTMLElement, Map<string, any>] {
		const parametrs = new Map<string, any>();
		return [HTML.CreateElement(
			"article",
			HTML.Append(
				HTML.CreateElement("header", HTML.SetText(method.returnType, method.documentation)),
				HTML.CreateElement(
					"ul",
					HTML.Append(method.parameters.map(this.ParameterInput.bind(this, parametrs))),
				)
			)), parametrs]
	}

	ParameterInput = (output: Map<string, any>, param: FieldDescription) => {
		return HTML.CreateElement("li",
			HTML.SetText(param.name, param.type),
			HTML.Append(
				this.TypeInput(param.name, param.type, output),
			))
	};

	getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
		if (nullable) {
			return nullable;
		}
		return default_;
	}
	private readonly nullRegexp = /null|undefined/;

	private json = new Map<string, Map<string, DeadlyRecipe>>();

	switchByType<T>(type: string, actions: {
		nullable: (type: string) => T,
		interface: (desc: InterfaceDescription) => T,
		deadly: (desc: ClassDescription) => T,
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
			return actions.deadly(this.classes.get(type)!);
		if (this.classes.has(type))
			return actions.class(this.classes.get(type)!);
		return actions.primitive(type);
	}
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
				// case "ImageBitmap":
					// return [HTML.SetInputType("file")]
				// TODO
				// case "color":
				// 	return [SetInputType("color")]
				default:
					return []
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
		return this.switchByType(type, {
			nullable: (type) => this.TypeInput(name, type, output, false),
			class: (clazz) => {
				const newMap1 = new Map<string, any>();
				output.set(name, newMap1);
				return HTML.CreateElement("ul",
					HTML.Append(clazz.consturctors[0].parameters.map(this.ParameterInput.bind(this, newMap1))),
				)
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
						[type.name, ...this.getOrDefault(this.inheritanceLists.get(type.name), [])].
							flatMap(typeName =>
								Iterators.WrapOrNoting(this.json.get(typeName)?.keys()).map(name =>
									HTML.CreateElement(
										"option",
										(option) => {
											option.value = name;
											option.text = name
										}
									)
								).toArray()
							),
					),
					(select) => select.dispatchEvent(new Event("change"))
				)
			},
			interface: (interf) => {
				if (interf.methods.length === 0) {
					const newMap = new Map<string, any>();
					output.set(name, newMap);
					return HTML.CreateElement("ul",
						HTML.Append(interf.fields.map(this.ParameterInput.bind(this, newMap))),
					)
				} else {
					return this.TypeInput(name, this.implementationsLists.get(interf.name)![1], output, required)
				}
			},
			primitive: (type) => {
				return HTML.CreateElement(
					"input",
					HTML.SetTitle(type),
					HTML.SetRequired(required),
					HTML.SetName(name),
					HTML.AddEventListener("change", function (ev: Event) {
						output.set(name, getValue(this as HTMLInputElement))
					}),
					...additionalModifiers(type));
			}
		});
	}
}
