import { Deadly } from "../base";

export abstract class Essence extends Deadly
{
	constructor(name: string) {
		super(name);
	}

	public abstract Tick(dt: number): void;
	public Clear() { };
}
