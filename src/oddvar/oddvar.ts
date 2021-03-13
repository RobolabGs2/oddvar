import { World } from "./world";
import { Deadly, DeadlyWorld, Factory, Serializable } from "./base";
import { Iterators } from "./iterator";
import { Point, Size } from "./geometry";
import { ClassDescription, ConstructorArgument, DeadlyRecipe, InterfaceDescription, ReflectionJSON, TypeManager } from "./reflection";
import { Player, Players } from "./players";
import { Graphics, RectangleTexture } from "./graphics";
import { Controller } from "./controller";


class Soul {
	constructor(
		public readonly factory: string,
		public readonly target: Deadly,
		public readonly type: string
	) { }
}

export type OddvarSnapshot = {
	Constructors: DeadlyRecipe[]
	Delta: Record<string, any>
	Destructors?: string[]
}

function isCreateMethod(propertyName: string | symbol | number, property: any): boolean {
	return typeof propertyName === "string" && propertyName.startsWith("Create") && property instanceof Function
}

export class Worlds
{
	constructor(
	readonly World: World,
	readonly Players: Players,
	readonly Graphics: Graphics,
	readonly Controller: Controller) {
	}
}

export class Oddvar {
	public underworld = new Map<string, Soul>();
	private newSouls = new Array<Soul>();
	private deletedSouls = new Array<string>();
	private parser: Parser;
	constructor(
		private worlds: Worlds,
		reflectionJson: ReflectionJSON
	) {
		let map = new Map<string, any>();
		for(let factory in worlds) {
			map.set(factory, this.Add(factory as keyof Worlds));
		}
		this.parser = new Parser(map, [Point, Size, RectangleTexture], reflectionJson, this.underworld);
	}

	public Tick(dt: number) {
		if (dt > 0.03)
			dt = 0.03;
		this.worlds.Graphics.Tick(dt);
		this.worlds.Controller.Tick(dt);
		this.worlds.Players.Tick(dt);
	}

	private GetDelta(force: boolean = false): Record<string, any> {
		const result: Record<string, any> = {};
		this.underworld.forEach((s, id) => {
			const delta = s.target.ToDelta(force);
			if (delta)
				result[id] = delta;
		})
		return result;
	}

	private ApplyDelta(snapshot: Record<string, any>): void {
		for (let name in snapshot) {
			this.underworld.get(name)?.target.FromDelta(snapshot[name]);
		}
	}

	private AddInUnderworld(factory: string, s: Deadly, type: string) {
		const soul = new Soul(factory, s, type);
		this.underworld.set(s.Name, soul);
		this.newSouls.push(soul);
		s.DeathSubscribe(() => {
			this.underworld.delete(s.Name);
			this.deletedSouls.push(s.Name);
		})
	}

	public Add<T extends keyof Worlds>(factory: T): Worlds[T] {
		return new Proxy<Worlds[T]>(this.worlds[factory], {
			get: (target, propertyName, recevier) => {
				const property = Reflect.get(target, propertyName, recevier)
				if (!isCreateMethod(propertyName, property)) return property
				return (...params: any) => {
					const deadly = property.apply(target, params);
					this.AddInUnderworld(factory, deadly, propertyName.toString().substr("create".length));
					return deadly;
				}
			}
		});
	}

	private GetConstructors(force: boolean): DeadlyRecipe[] {
		const result = (force ? Iterators.Wrap(this.underworld.values()).toArray() : this.newSouls).map((soul) => {
			return {
				factory: soul.factory,
				type: soul.type,
				name: soul.target.Name,
				constructor: soul.target.ToConstructor(),
			}
		});
		this.newSouls.length = 0;
		return result;
	}

	private GetDestructors(): string[] {
		return this.deletedSouls.splice(0, this.deletedSouls.length);
	}

	public GetSnapshot(force: boolean): OddvarSnapshot {
		return {
			Constructors: this.GetConstructors(force),
			Delta: this.GetDelta(force),
			Destructors: !force ? this.GetDestructors() : undefined,
		}
	}

	public ApplySnapshot(snapshot: OddvarSnapshot): void {
		this.ApplyConstructors(snapshot.Constructors);
		this.ApplyDelta(snapshot.Delta)
		if (snapshot.Destructors)
			this.ApplyDestructors(snapshot.Destructors);
	}

	private ApplyConstructors(constructors: DeadlyRecipe[]) {
		constructors.forEach(rec => this.parser.parseElement(rec));
	}

	private ApplyDestructors(destructors: string[]) {
		destructors.forEach(d => {
			this.underworld.get(d)?.target.Die();
			this.underworld.delete(d);
		})
	}
}

export class Parser {
	private primitives: Map<string, Function>;
	private factories: Map<string, any>;
	private typeManager: TypeManager;
	public constructor(
		factories: Map<string, any>, primitives: any[], reflectionJson: ReflectionJSON,
		private underworld: ReadonlyMap<string, Soul>,
		private creatorPrefix = "Create"
	) {
		this.factories = factories;
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
			throw new Error(`Unknown factory method '${factoryMethodName}' for ${type}!`);
		const elem = constructorMethod.call(
			factoryWorld,
			...[name, ...constructor].map((param, i) => {
				const paramType = constructorSignature.parameters[i];
				return this.typeManager.switchByType<ConstructorArgument>(paramType.type, {
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
							if (!this.typeManager.instanceOf(desc.name, deadly.constructor.name))
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
		const factories = new Map<string, InterfaceDescription>();
		const classes = new Map<string, ClassDescription>();
		json.classes.forEach(desc => (this.factories.has(desc.name) ? factories : classes).set(desc.name, desc));
		json.interfaces.forEach(desc => (this.factories.has(desc.name) ? factories : classes).set(desc.name, desc));
		return new TypeManager(factories, classes, new Map(json.interfaces.map(desc => [desc.name, desc])));
	}

}

function applyToConstructor(constructor: Function, argArray: any[]) {
	const args = [null].concat(argArray) as any;
	const factoryFunction = constructor.bind.apply(constructor, args);
	return new factoryFunction();
}
