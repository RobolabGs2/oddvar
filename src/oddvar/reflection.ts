import { Iterators } from "./iterator";
import { getOrDefault } from "./utils";

export interface DeadlyRecipe {
	factory: string
	type: string
	name: string
	constructor: ConstructorArgument[]
}

export type ConstructorArgument = string | number | object | Record<string, any> | ConstructorArgument[]

export interface ReflectionJSON {
	classes: ClassDescription[];
	interfaces: InterfaceDescription[];
}

export interface DocumentedDesctiption {
	readonly documentation: string;
}

export interface NamedSymbolDesctiption extends DocumentedDesctiption {
	readonly name: string
}

export interface SignatureDescription extends DocumentedDesctiption {
	readonly parameters: FieldDescription[];
	readonly returnType: string;
}

export interface FunctionDescription extends SignatureDescription {
	readonly name: string
}

export interface FieldDescription extends NamedSymbolDesctiption {
	readonly type: string;
}

export interface InterfaceDescription extends NamedSymbolDesctiption {
	readonly fields: FieldDescription[];
	readonly methods: FunctionDescription[];
}

export interface ClassDescription extends InterfaceDescription {
	readonly consturctors: SignatureDescription[];
	readonly prototype: string;
}

export class TypeManager {
	private inheritanceTree = new Map<string, string>();
	private inheritanceLists = new Map<string, string[]>();
	constructor(
		public readonly factories: Map<string, InterfaceDescription>,
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
			factory: factory,
			type: type,
			constructor: this.constructorParamFromMap(method, params),
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