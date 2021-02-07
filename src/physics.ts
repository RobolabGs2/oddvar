import { Deadly, DeadlyWorld } from "base"
import { Entity} from "world"
import { Matrix, Point, Size } from "geometry";

export interface PhysicalMaterial
{
	density: number;
}

export interface CollisionListener {(b1: Body, b2: Body): void}


export abstract class Essence extends Deadly
{
	public get X() { return this.entity.location.x }
	public get Y() { return this.entity.location.y }

	constructor(public readonly entity: Entity) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public abstract Tick(dt: number): void;
	public Clear() { }
}

export abstract class Sensor extends Essence
{
	protected blacklist = new Map<Body, number>();

	public AddToIgnore(body: Body) {
		this.blacklist.set(body, body.DeathSubscribe(b => {
			this.blacklist.delete(body);
		}))
	}

	public RemoveFromIgnore(body: Body) {
		const index = this.blacklist.get(body);
		if (index) {
			body.DeathUnsubscribe(index);
			this.blacklist.delete(body);
		}
	}

	public Take(body: Body) { }
}

export abstract class Body extends Essence
{
	public isStatic = false;
	public lineVelocity = new Point(0, 0);
	public lineForce = new Point(0, 0);
	public angleForce = 0;
	public angleVelocity = 0;

	private CollisionEvents = new Set<CollisionListener>();

	public constructor (entity: Entity, public readonly material: PhysicalMaterial) {
		super(entity);
	}

	public abstract Map(p: Point): number;
	public abstract Abba(): {p1: Point, p2: Point};
	public abstract Mass(): number;
	public abstract MomentOfInertia(): number;

	public AddCollisionListener(listener: CollisionListener) {
		this.CollisionEvents.add(listener);
	}

	public RemoveCollisionListener(listener: CollisionListener) {
		this.CollisionEvents.delete(listener);
	}

	public CallCollisionListener(b2: Body) {
		this.CollisionEvents.forEach(l => l(this, b2));
	}

	public Tick(dt: number) {
		if (this.isStatic) {
			this.angleForce = 0;
			this.lineForce.x = 0;
			this.lineForce.y = 0;
			return;
		}

		let m = this.Mass();
		let inertia = this.MomentOfInertia();

		this.angleVelocity += dt * this.angleForce * inertia;
		this.entity.rotation += dt * this.angleVelocity;
		this.angleForce = 0;

		this.lineVelocity = this.lineVelocity.Add(this.lineForce.Mult(dt * m));
		this.entity.location = this.entity.location.Add(this.lineVelocity.Mult(dt));
		this.lineForce.x = 0;
		this.lineForce.y = 0;
	}

	public Hit(force: Point, point: Point) {
		const delta = this.entity.location.Sub(point);
		const deltaLen = delta.Len();
		const deltaNorm = delta.Div(deltaLen);
		const lineForce = deltaNorm.Mult(deltaNorm.Dot(force));
		const angleForce = force.Sub(lineForce);
		this.lineForce = this.lineForce.Add(lineForce);

		const p = point.Add(angleForce);
		const p1 = point;
		const p2 = this.entity.location;
		const delta2 = p2.Sub(p1);
		const area = p2.x * p1.y - p2.y * p1.x;
		const value = delta2.y * p.x - delta2.x * p.y + area;

		this.angleForce += angleForce.Len() * deltaLen * Math.sign(value);
	}
}

export class RaySensor extends Sensor
{
	public distance = Infinity;
	public observable: Body | null = null;

	private start = new Point(0, 0);
	private direction = new Point(1, 0);

	private TakeRectangleBody(body: RectangleBody) {
		const points = body.RectanglePoints();
		const len = points.points.length;
		for(let i = 0; i < len; ++i) {
			if (this.TakeLineSegment(points.points[i], points.points[(i + 1) % len]))
				this.observable = body;
		}
	}

	private Det(p1: Point, p2: Point) {
		return p1.x * p2.y - p1.y * p2.x;
	}

	private TakeLineSegment(p1: Point, p2: Point) {
		const negv = p1.Sub(p2);
		const D = this.Det(this.direction, negv);
		if (D == 0) return;

		const dist = p1.Sub(this.start);
		const invD = 1 / D;
		const v = this.Det(this.direction, dist) * invD;
		const t = this.Det(dist, negv) * invD;
		if (v >= 0 && v < 1 && t > 0 && t < this.distance) {
			this.distance = t;
			return true;
		}
		return false;
	}

	public Tick(dt: number) {
	}

	public Clear() {
		this.distance = Infinity;
		this.observable = null;
		const m = this.entity.Transform();
		this.start = new Point(0, 0).Transform(m);
		this.direction = new Point(1, 0).Transform(m).Sub(this.start);
	}

	public Take(body: Body) {
		if (this.blacklist.get(body))
			return;
		if (body instanceof(RectangleBody))
			return this.TakeRectangleBody(body);
		throw new Error("unknown body");
	}
}

export class RectangleBody extends Body
{
	private abba = {p1: new Point(0, 0), p2: new Point(0, 0)};
	private rectanglePoints = { points: new Array<Point>(), m: Matrix.Ident(), size: new Size(0, 0), zero: new Point(0, 0)}

	public constructor(entity: Entity, public readonly material: PhysicalMaterial, public size: Size) {
		super(entity, material);
	}

	private RecalculateAbba() {
		let m = this.entity.Transform();
		let zero = new Point(0, 0).Transform(m);
		let p1 = new Point(this.size.width / 2, this.size.height / 2).Transform(m).Sub(zero);
		let p2 = new Point(this.size.width / 2, -this.size.height / 2).Transform(m).Sub(zero);
		let x = Math.max(Math.abs(p1.x), Math.abs(p2.x));
		let y = Math.max(Math.abs(p1.y), Math.abs(p2.y));
		this.abba = {p1: new Point(zero.x - x, zero.y - y), p2: new Point(zero.x + x, zero.y + y)};
	}

	private RecalculateRectanglePoints() {
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

		this.rectanglePoints = { points: points, m: m, size: size, zero: zero};
	}

	public Map(p: Point): number {
		p = p.Transform(this.entity.InverseTransform());
		return new Point(
			Math.max(Math.abs(p.x) - this.size.width / 2, 0),
			Math.max(Math.abs(p.y) - this.size.height / 2, 0)
		).Len();
	}

	public Abba() {
		return this.abba;
	}

	public Mass(): number {
		return 1/(this.size.Area() * this.material.density);
	}

	public MomentOfInertia(): number {
		return 1 / (this.size.width * this.size.height * (this.size.height * this.size.height +
			this.size.width * this.size.width) * 4 * this.material.density / 3);
	}

	public RectanglePoints(): {points: Point[], m: Matrix, size: Size, zero: Point} {
		return this.rectanglePoints;
	}

	public Clear() {
		this.RecalculateAbba();
		this.RecalculateRectanglePoints();
	}

	public Tick(dt: number) {
		super.Tick(dt);
	}
}

export class Physics extends DeadlyWorld<Essence>
{
	private bodies = new Array<Body>();
	private sensors = new Set<Sensor>();

	public Tick(dt: number) {
		this.Clear();
		this.Sort();

		for (let i = 0; i < this.bodies.length; ++i) {
			let b1 = this.bodies[i];
			let abba1 = b1.Abba();

			this.sensors.forEach(s => s.Take(b1));

			for (let j  = i + 1; j < this.bodies.length; ++j) {
				let b2 = this.bodies[j];
				let abba2 = b2.Abba();
				if (abba1.p2.x < abba2.p1.x)
					break;
				if (abba1.p1.y > abba2.p2.y || abba1.p2.y < abba2.p1.y)
					continue;
				let isCollision = false;
				isCollision = this.Intersect(b1, b2) || isCollision;
				isCollision = this.Intersect(b2, b1) || isCollision;
				if (isCollision) {
					b1.CallCollisionListener(b2);
					b2.CallCollisionListener(b1);
				}
			}
		}

		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	private Intersect(b1: Body, b2: Body): boolean {
		if (b1 instanceof(RectangleBody))
			if (b2 instanceof(RectangleBody))
				return this.IntersectRectangleRectangle(b1, b2);
		throw new Error("unknown body");
	}

	private IntersectRectangleRectangle(b1: RectangleBody, b2: RectangleBody): boolean {
		let base1 = b1.RectanglePoints();
		let base2 = b2.RectanglePoints();
		let result = false;
		for (let i = 0; i < 4; ++i) {
			let p = base1.points[i];
			let intersect = this.IntersectPointPoly(p, base2.points);
			if (intersect.intersect) {
				result = true;
				const k = 1000000;
				b1.Hit(intersect.nearNorm.Mult(intersect.nearDist * k), p);
				b2.Hit(intersect.nearNorm.Mult(-intersect.nearDist * k), p);
			}
		}
		return result;
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

	private Clear() {
		this.mortals.forEach(b => b.Clear());
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

	private AddSensor<T extends Sensor>(sensor: T) {
		this.sensors.add(sensor);
		sensor.DeathSubscribe(s => {
			this.sensors.delete(sensor);
		});
		return sensor
	}

	public Map(p: Point): number {
		let min = Infinity;
		this.bodies.forEach(b => min = Math.min(b.Map(p), min));
		return min;
	}

	public CreateRectangleBody(e: Entity, material: PhysicalMaterial, size: Size) {
		return this.AddBody(this.AddDeadly(new RectangleBody(e, material, size)));
	}

	public CreateRaySensor(e: Entity) {
		return this.AddSensor(this.AddDeadly(new RaySensor(e)));
	}
}
