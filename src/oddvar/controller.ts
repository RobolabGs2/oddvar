import { Deadly, DeadlyWorld } from "./base"
import { Entity } from "./world"
import { Point } from "./geometry";
import { Player } from "./players";
import { IBody } from "./physics/body";
import { KeyAction } from "./protocol";


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

type neededKeys = {a: boolean, w: boolean, s: boolean, d: boolean};
type neededKeysSync = {[property in keyof neededKeys]: number};

export class ControlledWalker extends Control
{
	public modified: boolean = false;
	private keys: neededKeys = {a: false, d: false, w: false, s: false}
	private keySync: neededKeysSync = {a: 10, d: 10, w: 10, s: 10}
	private _score = 0;

	private lastEntityLocation = new Point(0, 0);
	private targetEntityLocation = new Point(0, 0);
	private speed = new Point(0, 0);

	constructor(name: string, public readonly entity: Entity, public readonly player: Player) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number): void {
		const now = this.player.isCurrent ? Date.now() / 1000 : Infinity;
		if (this.player.isCurrent && this.player.wasSnapshot) {
			const serverDelay = now - this.player.sync / 1000;
			dt += serverDelay;
		}

		let move = new Point(0, 0);
		this.player.input.forEach(i => {
			const action = i.action == "down";
			switch(i.key)
			{
				case KeyAction.LEFT: this.KeyHandler("a", action, now); break;
				case KeyAction.RIGHT: this.KeyHandler("d", action, now); break;
				case KeyAction.UP: this.KeyHandler("w", action, now); break;
				case KeyAction.DOWN: this.KeyHandler("s", action, now); break;
			}
		});

		move.x -= this.keys.a ? Math.min(dt, now - this.keySync.a) : Math.max(0, dt - (now - this.keySync.a));
		move.x += this.keys.d ? Math.min(dt, now - this.keySync.d) : Math.max(0, dt - (now - this.keySync.d));
		move.y -= this.keys.w ? Math.min(dt, now - this.keySync.w) : Math.max(0, dt - (now - this.keySync.w));
		move.y += this.keys.s ? Math.min(dt, now - this.keySync.s) : Math.max(0, dt - (now - this.keySync.s));

		move = move.Mult(300);
		this.entity.location = move.Add(this.entity.location);
		if (this.entity.location.x < 0) this.entity.location.x = 0;
		if (this.entity.location.x > 500) this.entity.location.x = 500;
		if (this.entity.location.y < 0) this.entity.location.y = 0;
		if (this.entity.location.y > 500) this.entity.location.y = 500;

		if (this.player.isCurrent && this.player.wasSnapshot) {
			this.targetEntityLocation = this.entity.location.Mult(1);
			this.entity.location = this.lastEntityLocation;
			this.speed = this.targetEntityLocation.Sub(this.lastEntityLocation).Mult(1 / dt); // TODO:
		}
		if (this.player.isCurrent && !this.player.wasSnapshot) {
			// this.entity.location = this.entity.location.Add(this.speed.Mult(dt));
			this.entity.location = this.entity.location.Add(this.targetEntityLocation.Sub(this.entity.location).Mult(0.2));
		}
	

		this.lastEntityLocation = this.entity.location.Mult(1);
	}

	private KeyHandler(key: keyof neededKeys, action: boolean, now: number) {
		if (this.keys[key] == action)
			return;
		this.modified = true;
		this.keys[key] = action;
		this.keySync[key] =  this.player.isCurrent ? now : 0;
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


export class PhysicControlled extends Control
{
	public modified: boolean = false;
	private _score = 0;

	private keys: neededKeys = {a: false, d: false, w: false, s: false}

	constructor(name: string, public readonly body: IBody, public readonly player: Player) {
		super(name);
		body.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number): void {
		let move = new Point(0, 0);
		this.player.input.forEach(i => {
			const action = i.action == "down";
			switch(i.key)
			{
				case KeyAction.LEFT: this.KeyHandler("a", action); break;
				case KeyAction.RIGHT: this.KeyHandler("d", action); break;
				case KeyAction.UP: this.KeyHandler("w", action); break;
				case KeyAction.DOWN: this.KeyHandler("s", action); break;
			}
		});

		move.x -= this.keys.a ? dt : 0;
		move.x += this.keys.d ? dt : 0;
		move.y -= this.keys.w ? dt : 0;
		move.y += this.keys.s ? dt : 0;

		move = move.Mult(30000000);
		this.body.Kick(move);
	}

	private KeyHandler(key: keyof neededKeys, action: boolean) {
		if (this.keys[key] == action)
			return;
		this.keys[key] = action;
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
	}

	ToDelta(force: boolean) {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return { score: this.score};
	}

	ToConstructor(): any[] {
		return [this.body.Name, this.player.Name]
	}
}


export class Controller extends DeadlyWorld<Control>
{
	private clientControllers = new Set<Control>();

	constructor(public isClient: boolean) {
		super();
	}

	public Tick(dt: number) {
		if (this.isClient) {
			this.clientControllers.forEach(e => {
				e.Tick(dt);
			})
		} else {
			this.mortals.forEach(e => {
				e.Tick(dt);
			})
		}
	}

	private AddClientController<T extends Control>(c: T): T{
		this.clientControllers.add(c);
		c.DeathSubscribe(d => {
			this.clientControllers.delete(c);
		})
		return c;
	}

	public CreateWalkController(name: string, entity: Entity): WalkController {
		return this.AddClientController(this.AddDeadly(new WalkController(name, entity)));
	}

	public CreateSpinRoundController(name: string, entity: Entity): SpinRoundController {
		return this.AddClientController(this.AddDeadly(new SpinRoundController(name, entity)));
	}

	public CreateControlledWalker(name: string, point: Entity, player: Player): ControlledWalker {
		return this.AddClientController(this.AddDeadly(new ControlledWalker(name, point, player)));
	}

	public CreatePhysicControlled(name: string, body: IBody, player: Player): PhysicControlled {
		return this.AddDeadly(new PhysicControlled(name, body, player));
	}
}
