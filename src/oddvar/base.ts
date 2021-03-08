
export interface DeathListener{(c: Deadly): void}

export abstract class Deadly implements Serializable
{
	public Name: string = "Untitled";

	private deathList = new Array<DeathListener>();
	public DeathSubscribe(callback: DeathListener): number {
		return this.deathList.push(callback) - 1;
	}

	public DeathUnsubscribe(index: number) {
		return this.deathList[index] = d => {};
	}

	public Die() {
		this.deathList.forEach(e => {
			e(this);
		});
	}

	abstract FromDelta(delta: any): void;
	abstract ToDelta(force: boolean): any;
	abstract ToConstructor(): any[];
}

export abstract class DeadlyWorld<T extends Deadly> implements Factory
{
	protected mortals = new Set<T>();

	protected AddDeadly<E extends T>(e: E): E {
		this.mortals.add(e);
		e.DeathSubscribe((d) => {this.mortals.delete(d as T)});
		return e;
	}

	abstract Tick(dt: number): void;
}

export interface Serializable
{
	readonly Name: string;
	FromDelta(delta: any): void;
	ToDelta(force: boolean): any;
	ToConstructor(): any[];
}

export interface Factory
{
	Tick(dt: number): void;
}
