import { Deadly } from "./base";
import { Iterators } from "./iterator";

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

export interface DeadlyRecipe {
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

export interface FunctionDescription extends SignatureDescription {
	readonly name: string
}

export interface FieldDescription extends NamedSymbolDesctiption {
	readonly type: string;
}

interface InterfaceDescription extends NamedSymbolDesctiption {
	readonly fields: FieldDescription[];
	readonly methods: FunctionDescription[];
}

export interface ClassDescription extends InterfaceDescription {
	readonly consturctors: SignatureDescription[];
	readonly prototype: string;
}

export function getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
	if (nullable) {
		return nullable;
	}
	return default_;
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
					this.addChild(type, desc);
				}
			}
		});
	}

	private addChild(type: string, desc: ClassDescription) {
		let siblings = this.inheritanceLists.get(type);
		if (siblings) {
			siblings.push(desc.name);
		} else {
			this.inheritanceLists.set(desc.prototype, [desc.name]);
		}
	}

	instanceOf(expected: string, actual: string): boolean {
		return expected === actual || this.inheritanceLists.get(expected)?.find(x => x === actual) === actual
	}

	*getDeadlies(deadlyName: string) {
		for (let deadlies of [deadlyName, ...getOrDefault(this.inheritanceLists.get(deadlyName), [])].
			map(typeName =>
				Iterators.WrapOrNoting(this._json.get(typeName)?.values()))) {
			for (let deadly of deadlies.toArray())
				yield deadly;
		}
	}

	createDeadly(name: string, type: string, factory: string, method: SignatureDescription, params: Map<string, any>): DeadlyRecipe {
		const deadly: DeadlyRecipe = {
			name: name,
			type: `${factory.toLowerCase()}.${type}`,
			constructor: this.constructorParamFromMap(method, params),
			child: [],
		};
		let deadlies = this._json.get(type);
		if (!deadlies) {
			deadlies = new Map<string, DeadlyRecipe>();
			this._json.set(type, deadlies);
		}
		deadlies.set(deadly.name, deadly);
		return deadly;
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
	private readonly nullRegexp = /null|undefined/;

	private _json = new Map<string, Map<string, DeadlyRecipe>>();
	public get json(): ReadonlyMap<string, ReadonlyMap<string, Readonly<DeadlyRecipe>>> {
		return this._json
	}

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

}
