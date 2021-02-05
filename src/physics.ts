import { Deadly, DeadlyWorld } from "base"
import { Entity} from "world"
import { Matrix, Point, Size } from "geometry";

export interface PhysicalMaterial
{
	density: number;
}

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
	public isStatic = false;
	public lineVelocity = new Point(0, 0);
	public lineForce = new Point(0, 0);
	public angleForce = 0;
	public angleVelocity = 0;

	public constructor (entity: Entity, public readonly material: PhysicalMaterial) {
		super(entity);
	}

	public abstract Abba(): {p1: Point, p2: Point};

	public Tick(dt: number) {
		if (this.isStatic) {
			this.angleForce = 0;
			this.lineForce.x = 0;
			this.lineForce.y = 0;
			return;
		}

		this.angleVelocity += dt * this.angleForce;
		this.entity.rotation += dt * this.angleVelocity;
		this.angleForce = 0;

		this.lineVelocity = this.lineVelocity.Add(this.lineForce.Mult(dt));
		this.entity.location = this.entity.location.Add(this.lineVelocity.Mult(dt));
		this.lineForce.x = 0;
		this.lineForce.y = 0;
	}

	public Hit(force: Point, point: Point) {
		let delta = this.entity.location.Sub(point);
		let deltaLen = delta.Len();
		let deltaNorm = delta.Div(deltaLen);
		let lineForce = deltaNorm.Mult(deltaNorm.Dot(force));
		let angleForce = force.Sub(lineForce);
		this.lineForce = this.lineForce.Add(lineForce);

		let p = point.Add(angleForce);
		let p1 = point;
		let p2 = this.entity.location;
		let delta2 = p2.Sub(p1);
		let area = p2.x * p1.y - p2.y * p1.x;
		let value = delta2.y * p.x - delta2.x * p.y + area;

		this.angleForce += angleForce.Len() * deltaLen / 100 * Math.sign(value);
	}
}

export class RectangleBody extends Body
{
	private abba = {p1: new Point(0, 0), p2: new Point(0, 0)};

	public constructor(entity: Entity, public readonly material: PhysicalMaterial, public size: Size) {
		super(entity, material);
	}

	public Abba() {
		return this.abba;
	}

	public RectanglePoints(): { points: Point[], m: Matrix, size: Size, zero: Point} {
		let m = this.entity.Transform();
		let size = this.size;
		let zero = new Point(0, 0).Transform(m);

		let points = [
			new Point(size.width / 2, size.height / 2),
			new Point(-size.width / 2, size.height / 2),
			new Point(-size.width / 2, -size.height / 2),
			new Point(size.width / 2, -size.height / 2)
		];

		for (let i = 0; i < 4; ++i) {
			points[i] = points[i].Transform(m);
		}

		return { points: points, m: m, size: size, zero: zero};
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
				this.Intersect(b2, b1);
			}
		}

		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	private Intersect(b1: Body, b2: Body) {
		if (b1 instanceof(RectangleBody)) {
			if (b2 instanceof(RectangleBody))
				this.IntersectRectangleRectangle(b1, b2);
		}
	}

	private IntersectRectangleRectangle(b1: RectangleBody, b2: RectangleBody) {
		let base1 = b1.RectanglePoints();
		let base2 = b2.RectanglePoints();
		for (let i = 0; i < 4; ++i) {
			let p = base1.points[i];
			let intersect = this.IntersectPointPoly(p, base2.points);
			if (intersect.intersect) {
				const k = 1000;
				b1.Hit(intersect.nearNorm.Mult(intersect.nearDist * k), p);
				b2.Hit(intersect.nearNorm.Mult(-intersect.nearDist * k), p);
				// console.log(intersect.nearNorm);
			}
		}
	}

	private IntersectPointPoly(p: Point, poly: Point[]): {
			intersect: boolean,
			near: number,
			nearDist: number,
			nearNorm: Point
		} {
		let len = poly.length;
		let near = -1;
		let nearDist = Infinity;
		let nearNorm = new Point(0, 0);
		let intersect = true;
		for (let i = 0; i < len; ++i) {
			let p1 = poly[i];
			let p2 = poly[(i + 1) % len];
			let delta = p2.Sub(p1);
			let area = p2.x * p1.y - p2.y * p1.x;
			let value = delta.y * p.x - delta.x * p.y + area
			if (value >= 0) {
				intersect = false;
				break;
			}
			let deltaLen = delta.Len();
			let distance = Math.abs(value) / delta.Len();
			if (distance < nearDist) {
				near = i;
				nearDist = distance;
				nearNorm = new Point(delta.y, -delta.x).Div(deltaLen);
			}
		}
		return {
			intersect: intersect,
			near: near,
			nearDist: nearDist,
			nearNorm: nearNorm
		};
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

	public CreateRectangleBody(e: Entity, material: PhysicalMaterial, size: Size) {
		return this.AddBody(this.AddDeadly(new RectangleBody(e, material, size)));
	}
}
