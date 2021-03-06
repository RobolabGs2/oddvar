import { Deadly } from "base";
import { Entity } from "world";

export abstract class Essence extends Deadly
{
	public get X() { return this.entity.location.x }
	public get Y() { return this.entity.location.y }

	constructor(public readonly entity: Entity) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public abstract Tick(dt: number): void;
	public Clear() { }
}