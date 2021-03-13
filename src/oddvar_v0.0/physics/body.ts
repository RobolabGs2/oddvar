import { Deadly, DeadlyWorld } from "oddvar/base"
import { Entity} from "world"
import { Matrix, Point, Size } from "geometry";
import { Essence } from "oddvar/physics/essence";

export interface PhysicalMaterial
{
	density: number;
}

export interface CollisionListener {(b1: Body, b2: Body): void}

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

	public GetVelocity(p: Point): Point {
		const delta = this.entity.location.Sub(p);
		return this.lineVelocity.Add(
			new Point(delta.y, -delta.x).Norm().Mult(delta.Len() * this.angleVelocity)
		);
	}

	public Tick(dt: number) {
		if (this.isStatic) {
			this.angleForce = 0;
			this.lineForce.x = 0;
			this.lineForce.y = 0;
			return;
		}

		let m = this.Mass();
		let inertia = this.MomentOfInertia()/10;

		this.angleVelocity += dt * this.angleForce / inertia;
		this.entity.rotation += dt * this.angleVelocity;
		this.angleForce = 0;

		this.lineVelocity = this.lineVelocity.Add(this.lineForce.Mult(dt / m))//.Mult(0.9);
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
		return (this.size.Area() * this.material.density);
	}

	public MomentOfInertia(): number {
		return (this.size.width * this.size.height * (this.size.height * this.size.height +
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