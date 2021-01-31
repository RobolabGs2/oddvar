import { Deadly, DeadlyWorld } from "base"
import { Entity} from "world"
import { Point } from "geometry";
import { Body } from "physics";


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
	private counter = 0;
	constructor(private entity: Entity) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		++this.counter;
		this.time += dt;
		let velocity = new Point(10, 0);
		this.entity.location = this.entity.location.Add(velocity.Mult(dt));
		this.entity.rotation += dt * 0.5;
		if(this.time > 20) {
			console.log(this.counter);
			this.entity.Die();
		}
	}
}

export class KickController extends Control
{
	constructor(private body: Body, velocity: Point, isStatic: boolean) {
		super();
		body.lineVelocity = velocity;
		body.isStataic = isStatic;
		this.Die();
	}

	public Tick(dt: number) {
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

	public CreateKickController(body: Body, velocity: Point, isStatic: boolean = false): KickController {
		return this.AddDeadly(new KickController(body, velocity, isStatic));
	}
}
