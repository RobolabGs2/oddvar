import { Deadly, DeadlyWorld } from "./base"
import { Entity } from "./world"
import { Point } from "./geometry";


export abstract class Control extends Deadly {
	public constructor(name: string) {
		super(name);
	}

	public abstract Tick(d: number): void;
}

export class WalkController extends Control {
	private modified: boolean = false;
	private time = 0;
	constructor(name: string, private entity: Entity) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		this.time += dt;
		let velocity = new Point(10, 0);
		this.entity.location = this.entity.location.Add(velocity.Mult(dt));
		this.entity.rotation += dt * 0.5;
		if (this.time > 20) {
			this.entity.Die();
		}
	}

	FromDelta(delta: any): void {
		this.time = delta;
	}

	ToDelta(force: boolean) {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return this.time;
	}

	ToConstructor(): any[] {
		return [this.entity.Name]
	}
}

export class SpinRoundController extends Control {
	private modified: boolean = false;
	private time = 0;
	constructor(name: string, private entity: Entity) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		this.time += dt;
		this.entity.rotation += dt * 0.5;
	}

	FromDelta(delta: any): void {
		this.time = delta;
	}

	ToDelta(force: boolean) {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return this.time;
	}

	ToConstructor(): any[] {
		return [this.entity.Name]
	}
}


export class Controller extends DeadlyWorld<Control>
{
	public Tick(dt: number) {
		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	public CreateWalkController(name: string, entity: Entity): WalkController {
		return this.AddDeadly(new WalkController(name, entity));
	}

	public CreateSpinRoundController(name: string, entity: Entity): SpinRoundController {
		return this.AddDeadly(new SpinRoundController(name, entity));
	}
}
