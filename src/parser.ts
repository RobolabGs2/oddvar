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

	parseElement({ type, constructor, child }: ElementRecipe, parent?: any) {
		const [factoryName, constructorName] = type.split(".");
		const factory = this.factories.get(factoryName);
		if (!factory)
			throw new Error(`Unknown factory '${factoryName}' for ${type}!`);
		const constructorMethod = factory[`${this.creatorPrefix}${constructorName}`] as Function;
		if (!constructorMethod || !(constructorMethod instanceof Function))
			throw new Error(`Unknown factory method '${constructorMethod}' for ${type}!`);
		const elem = constructorMethod.call(factory, ...(parent ? [parent, ...constructor] : constructor));
		child?.forEach(element => this.parseElement(element, elem));
	}
}

export interface ElementRecipe {
	type: string
	constructor: []
	child: []
}