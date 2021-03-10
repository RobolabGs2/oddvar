import { World } from "./world";
import { Deadly, Factory, Serializable } from "./base";
import { Iterators } from "./iterator";
import { Point } from "./geometry";
import { ClassDescription, ConstructorArgument, DeadlyRecipe, ReflectionJSON, TypeManager } from "./reflection";


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

function isCreateMethod(propertyName: string | symbol | number, property: any): boolean {
	return typeof propertyName === "string" && propertyName.startsWith("Create") && property instanceof Function
}

export class Oddvar {
	public underworld = new Map<string, Soul>();
	private parser: Parser;
	constructor(
		public world: World,
		reflectionJson: ReflectionJSON
	) {
		this.parser = new Parser([world].map(this.Add.bind(this)), [Point], reflectionJson, this.underworld);
	}

	public tick(dt: number) {
		if (dt > 0.03)
			dt = 0.03;
		// factories.tick(dt);
	}

	public GetDelta(force: boolean = false): Record<string, any> {
		const result: Record<string, any> = {};
		this.underworld.forEach((s, id) => {
			const delta = s.target.ToDelta(force);
			if (delta)
				result[id] = delta;
		})
		return result;
	}

	public ApplyDelta(snapshot: Record<string, any>): void {
		for (let name in snapshot) {
			this.underworld.get(name)?.target.FromDelta(snapshot[name]);
		}
	}

	private AddInUnderworld(factory: string, s: Serializable) {
		this.underworld.set(s.Name, new Soul(factory, s));
	}

	public Add<T extends Factory>(factory: T): T {
		return new Proxy<T>(factory, {
			get: (target, propertyName, recevier) => {
				const property = Reflect.get(target, propertyName, recevier)
				if (!isCreateMethod(propertyName, property)) return property
				return (...params: any) => {
					const deadly = property.apply(target, params);
					this.AddInUnderworld(target.constructor.name, deadly);
					return deadly;
				}
			}
		});
	}

	public GetConstructors(): DeadlyRecipe[] {
		return Iterators.Wrap(this.underworld.entries()).map(([name, soul]) => {
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
						if (!this.typeManager.instanceOf(desc.name, param.constructor.name))
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
