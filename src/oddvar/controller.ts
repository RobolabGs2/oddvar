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
	private _score = 0;

	constructor(name: string, public readonly entity: Entity, public readonly player: Player) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number): void {
		let move = new Point(0, 0);
		this.player.input.forEach(i => {
			console.log(i)
			switch(i)
			{
				case "a": move.x -= 1; break;
				case "d": move.x += 1; break;
				case "w": move.y -= 1; break;
				case "s": move.y += 1; break;
			}
		});
		move = move.Mult(10);
		this.entity.location = move.Add(this.entity.location);
		if (move.Len() > 0) {
			console.log(move, this.entity.location);
		}
	}

	public get score() : number {
		return this._score;
	}

	public set score(value: number) {
		this._score = value;
		this.modified = true;
	}

	FromDelta(delta: any): void {
		this._score = delta;
	}

	ToDelta(force: boolean) {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return this.score;
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
