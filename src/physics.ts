import { Deadly, DeadlyWorld } from "./base"
import { Entity} from "./world"
import { Matrix, Point, Size } from "./geometry";

export abstract class Essence extends Deadly
{
	public get X() { return this.entity.location.x }
	public get Y() { return this.entity.location.y }

	constructor(public readonly entity: Entity) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public abstract Tick(dt: number): void;
}

export abstract class Body extends Essence
{
	public isStataic = false;
	public lineVelocity = new Point(0, 0);
	public lineForce = new Point(0, 0);
	public angleForce = 0;
	public angleVelocity = 0;

	public abstract Abba(): {p1: Point, p2: Point};

	public Tick(dt: number) {
		if (this.isStataic) {
			this.angleForce = 0;
			this.lineForce.x = 0;
			this.lineForce.y = 0;
			return;
		}

		this.entity.rotation += dt * this.angleVelocity;
		this.angleVelocity += dt * this.angleForce;
		this.angleForce = 0;

		this.entity.location = this.entity.location.Add(this.lineVelocity.Mult(dt));
		this.lineVelocity = this.lineVelocity.Add(this.lineForce.Mult(dt));
		this.lineForce.x = 0;
		this.lineForce.y = 0;
	}
}

export class RectangleBody extends Body
{
	private abba = {p1: new Point(0, 0), p2: new Point(0, 0)};

	public constructor(entity: Entity, public size: Size) {
		super(entity);
	}

	public Abba() {
		return this.abba;
	}

	public Tick(dt: number) {
		super.Tick(dt);
		let m = this.entity.Transform();
		let zero = new Point(0, 0).Transform(m);
		let p1 = new Point(this.size.width / 2, this.size.height / 2).Transform(m).Sub(zero);
		let p2 = new Point(this.size.width / 2, -this.size.height / 2).Transform(m).Sub(zero);
		let x = Math.max(Math.abs(p1.x), Math.abs(p2.x));
		let y = Math.max(Math.abs(p1.y), Math.abs(p2.y));
		this.abba = {p1: new Point(zero.x - x, zero.y - y), p2: new Point(zero.x + x, zero.y + y)};
	}
}

export class Physics extends DeadlyWorld<Body>
{
	public bodies = new Array<Body>();

	public Tick(dt: number) {
		this.Sort();

		for (let i = 0; i < this.bodies.length; ++i) {
			let b1 = this.bodies[i];
			let abba1 = b1.Abba();
			for (let j  = i + 1; j < this.bodies.length; ++j) {
				let b2 = this.bodies[j];
				let abba2 = b2.Abba();
				if (abba1.p2.x < abba2.p1.x)
					break;
				if (abba1.p1.y > abba2.p2.y || abba1.p2.y < abba2.p1.y)
					continue;
				this.Intersect(b1, b2);
			}
		}

		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	private Intersect(b1: Body, b2: Body) {
		//console.log("intersect?");
	}

	private Sort() {
		for (let i = 1; i < this.bodies.length; ++i)
			for (let j = i; j > 0; --j) {
				if (this.bodies[j - 1].Abba().p1.x <= this.bodies[j].Abba().p1.x)
					break;
				this.Swap(j - 1, j);
			}
	}

	private Swap(i: number, j: number) {
		let buf = this.bodies[i];
		this.bodies[i] = this.bodies[j];
		this.bodies[j] = buf;
		//console.log("Swap!!!");
	}

	private AddBody<T extends Body>(body: T): T {
		this.bodies.push(body);
		body.DeathSubscribe(b => {
			for (let i = 0; i < this.bodies.length - 1; ++i)
				if (this.bodies[i] == body)
					this.Swap(i, i + 1);
			this.bodies.pop();
		});
		return body;
	}

	public CreateRectangleBody(e: Entity, size: Size) {
		return this.AddBody(this.AddDeadly(new RectangleBody(e, size)));
	}
}
