import { Entity } from "../world";
import { Deadly } from "../base";

export abstract class Essence extends Deadly
{
	constructor(name: string, public readonly entity: Entity) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public abstract Tick(dt: number): void;
	public Clear() { };
}
