import { Deadly, DeadlyWorld } from "./base"
import { Entity} from "./world"
import { Point, Size } from "./geometry";


export abstract class Control extends Deadly
{
	public constructor() {
		super();
	}

	public abstract Tick(d: number): void;
}

export class WalkController extends Control
{
	private time = 0;
	constructor(private entity: Entity) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		this.time += dt;
		let velocity = new Point(10, 0);
		this.entity.location = this.entity.location.Add(velocity.Mult(dt));
		this.entity.rotation += dt * 0.5;
		if(this.time > 20)
			this.entity.Die();
	}
}

export class Controller extends DeadlyWorld<Control>
{
	public Tick(dt: number) {
		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	public CreateWalkController(entity: Entity): WalkController {
		return this.AddDeadly(new WalkController(entity));
	}
}
