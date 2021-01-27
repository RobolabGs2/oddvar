
export interface DeathListener{(c: Deadly): void}

export class Deadly
{
	private deathList = new Array<DeathListener>();
	public DeathSubscribe(callback: DeathListener): number {
		return this.deathList.push(callback) - 1;
	}

	public Die() {
		this.deathList.forEach(e => {
			e(this);
		});
	}
}

export class DeadlyWorld<T extends Deadly>
{
	protected mortals = new Set<T>();

	protected AddDeadly<E extends T>(e: E): E {
		this.mortals.add(e);
		e.DeathSubscribe((d) => {this.mortals.delete(d as T)});
		return e;
	}
}
