import { World } from "./world";
import { Deadly, Factory, Serializable } from "./base";
import { Iterators } from "./iterator";
import { Point } from "./geometry";


class Soul {
	constructor(
		public readonly factory: string,
		public readonly target: Serializable
	) { }
}

export type OddvarSnapshot = {
	Constructor?: DeadlyRecipe[]
	Delta: Record<string, any>
}

export class Oddvar {
	public underWorld = new Map<string, Soul>();
	private parser: Parser;
	constructor(
		public world: World,
		reflectionJson: ReflectionJSON
	) {
		this.parser = new Parser([this.Add(this.world)], [Point], reflectionJson, this.underWorld);
	}

	public tick(dt: number) {
		if (dt > 0.03)
			dt = 0.03;
		// factories.tick(dt);
	}

	public GetDelta(force: boolean = false): Record<string, any> {
		const result: Record<string, any> = {};
		this.underWorld.forEach((s, id) => {
			const delta = s.target.ToDelta(force);
			if (delta)
				result[id] = delta;
		})
		return result;
	}

	public ApplyDelta(snapshot: Record<string, any>): void {
		for (let name in snapshot) {
			this.underWorld.get(name)?.target.FromDelta(snapshot[name]);
		}
	}

	private AddInUnderWorld(factory: string, s: Serializable) {
		this.underWorld.set(s.Name, new Soul(factory, s));
	}

	public Add<T extends Factory>(factory: T): T {
		return new Proxy<T>(factory, {
			get: (target, propertyName, recevier) => {
				const property = Reflect.get(target, propertyName)
				if (typeof propertyName === "string") {
					if (propertyName.startsWith("Create") && property instanceof Function) {
						const f = property as Function;
						return (...params: any) => {
							const deadly = f.apply(target, params);
							this.AddInUnderWorld(target.constructor.name, deadly);
							return deadly;
						}
					}
				}
				return property
			}
		});
	}

	public GetConstructors(): DeadlyRecipe[] {
		return Iterators.Wrap(this.underWorld.entries()).map(([name, soul]) => {
			return {
				factory: soul.factory,
				type: soul.target.constructor.name,
				name: name,
				constructor: soul.target.ToConstructor(),
			}
		}).toArray();
	}

	public GetSnapshot(): OddvarSnapshot {
		return {
			Constructor: this.GetConstructors(),
			Delta: this.GetDelta(true),
		}
	}

	public ApplySnapshot(snapshot: OddvarSnapshot): void {
		if (snapshot.Constructor)
			this.ApplyConstructors(snapshot.Constructor);
		this.ApplyDelta(this.GetDelta())
	}

	public ApplyConstructors(constructors: DeadlyRecipe[]) {
		constructors.forEach(rec => this.parser.parseElement(rec));
	}
}

export interface DeadlyRecipe {
	factory: string
	type: string
	name: string
	constructor: ConstructorArgument[]
}

export class Parser {
	private primitives: Map<string, Function>;
	private factories: Map<string, any>;
	private typeManager: TypeManager;
	public constructor(
		factories: object[], primitives: any[], reflectionJson: ReflectionJSON,
		private underworld: ReadonlyMap<string, Soul>,
		private creatorPrefix = "Create"
	) {
		this.factories = new Map(factories.map(v => [v.constructor.name, v]));
		this.primitives = new Map(primitives.map(v => v.prototype.constructor).map(value => [value.name, value]));
		this.typeManager = this.newTypeManager(reflectionJson);
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

	parseElement({ factory, type, constructor, name }: DeadlyRecipe) {
		const factoryWorld = this.factories.get(factory);
		if (!factory)
			throw new Error(`Unknown factory '${factory}' for ${type}!`);
		const factoryMethodName = `${this.creatorPrefix}${type}`;
		const constructorMethod = factoryWorld[factoryMethodName] as Function | undefined;
		const constructorSignature = this.typeManager.factories.get(factory)?.methods.find(d => d.name === factoryMethodName)
		if (!constructorMethod || !(constructorMethod instanceof Function) || !constructorSignature)
			throw new Error(`Unknown factory method '${constructorMethod}' for ${type}!`);
		const elem = constructorMethod.call(
			factoryWorld,
			...[name, ...constructor].map((param, i) => {
				const paramType = constructorSignature.parameters[i];
				this.typeManager.switchByType<ConstructorArgument>(paramType.type, {
					primitive: () => param,
					class: (desc) => {
						if (!(param instanceof Array)) {
							// throw new TypeError(`Expected array for ${desc.name} constructor, actual ${param}`)
							const rec = param as Record<string, any>;
							param = desc.consturctors[0].parameters.map(desc => rec[desc.name])
						}
						const classConstructor = this.primitives.get(desc.name);
						if (classConstructor)
							return applyToConstructor(classConstructor, param as ConstructorArgument[]);
						throw new Error(`Constructor for ${desc.name} not found`)
					},
					deadly: (desc) => {
						if (typeof param === "string") {
							const deadly = this.underworld.get(param)?.target
							if (!deadly)
								throw new Error(`Not found deadly with name ${param}`);
							if (deadly.constructor.name != desc.name)
								throw new TypeError(`Expected deadly ${param} typeof ${desc.name}, actual ${deadly.constructor.name} in deadly constructor ${name}`)
							return deadly;
						}
						if (param.constructor.name != desc.name)
							throw new TypeError(`Expected deadly typeof ${desc.name}, actual ${param.constructor.name} in deadly constructor ${name}`)
						return param;
					},
					interface: (desc) => {
						console.warn("ignore interface", desc, param)
						return param
					},
					nullable: (type) => {
						// TODO
						return param
					}
				})
				return (typeof param) === "string" && this.namedEntities.has(param as string) ? this.namedEntities.get(param as string) : param
			}));
		if (elem instanceof Deadly) {
			this.namedEntities.set(elem.Name, elem)
		}
	}

	private newTypeManager(json: ReflectionJSON): TypeManager {
		const factories = new Map<string, ClassDescription>();
		const classes = new Map<string, ClassDescription>();
		json.classes.forEach(desc => (this.factories.has(desc.name) ? factories : classes).set(desc.name, desc));
		return new TypeManager(factories, classes, new Map(json.interfaces.map(desc => [desc.name, desc])));
	}

}

function applyToConstructor(constructor: Function, argArray: any[]) {
	const args = [null].concat(argArray) as any;
	const factoryFunction = constructor.bind.apply(constructor, args);
	return new factoryFunction();
}


type ConstructorArgument = string | number | object | Record<string, any> | ConstructorArgument[]

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
