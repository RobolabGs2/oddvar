import { Deadly, DeadlyWorld } from "./base"
import { Entity } from "./world"
import { Point } from "./geometry";
import { Player } from "./players";


export abstract class Control extends Deadly {
	public constructor(name: string) {
		super(name);
	}

	public abstract Tick(dt: number): void;
}

export class WalkController extends Control {
	private modified: boolean = false;
	private time = 0;
	constructor(name: string, private entity: Entity) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		this.modified = true;
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
		this.modified = true;
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

export class ControlledWalker extends Control
{
	public modified: boolean = false;
	private keys = {a: false, d: false, w: false, s: false}
	private _score = 0;

	constructor(name: string, public readonly entity: Entity, public readonly player: Player) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number): void {
		let move = new Point(0, 0);
		this.player.input.forEach(i => {
			const action = i.action == "down";
			switch(i.key)
			{
				case "KeyA": this.modified = this.modified || this.keys.a != action; this.keys.a = action; break;
				case "KeyD": this.modified = this.modified || this.keys.d != action; this.keys.d = action; break;
				case "KeyW": this.modified = this.modified || this.keys.w != action; this.keys.w = action; break;
				case "KeyS": this.modified = this.modified || this.keys.s != action; this.keys.s = action; break;
			}
		});

		move.x -= this.keys.a ? 1 : 0;
		move.x += this.keys.d ? 1 : 0;
		move.y -= this.keys.w ? 1 : 0;
		move.y += this.keys.s ? 1 : 0;

		move = move.Mult(5);
		this.entity.location = move.Add(this.entity.location);
	}

	public get score() : number {
		return this._score;
	}

	public set score(value: number) {
		this._score = value;
		this.modified = true;
	}

	FromDelta(delta: any): void {
		this._score = delta.score;
		if (!this.player.isCurrent)
			this.keys = delta.keys;
	}

	ToDelta(force: boolean) {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return { score: this.score, keys: this.keys };
	}

	ToConstructor(): any[] {
		return [this.entity.Name, this.player.Name]
	}
}

export class Controller extends DeadlyWorld<Control>
{
	constructor(private enableTick: boolean) {
		super();
	}

	public Tick(dt: number) {
		if (!this.enableTick)
			return;
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

	public CreateControlledWalker(name: string, point: Entity, player: Player): ControlledWalker {
		return this.AddDeadly(new ControlledWalker(name, point, player));
	}
}
