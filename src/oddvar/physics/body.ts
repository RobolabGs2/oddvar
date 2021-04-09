import { Deadly, DeadlyWorld } from "../base"
import { Entity} from "../world"
import { Matrix, Point, Size } from "../geometry";
import { Essence } from "./essence";

export interface PhysicalMaterial
{
	density: number;
	lineFriction: number;
	angleFriction: number;
	static: boolean;
	layers : number;
}

const defaultPhysicalMaterial: PhysicalMaterial = { density: 1, lineFriction: 0, angleFriction: 0, static: false, layers: -1 }

function MergeWithDefault<T>(defaultValue: Readonly<T>, value: Partial<T>): T {
	for(let x in defaultValue) {
		if(value[x] === undefined) {
			value[x] = defaultValue[x];
		}
	}
	return value as T;
}

export interface CollisionListener {(self: Body, another: Body): void}

export interface IBody extends Deadly
{
	readonly entity: Entity;
	Kick(force: Point): void;
}


export abstract class Body extends Essence implements IBody
{
	public lineVelocity = new Point(0, 0);
	public lineForce = new Point(0, 0);
	public angleForce = 0;
	public angleVelocity = 0;
	public readonly material: PhysicalMaterial;

	private CollisionEvents = new Set<CollisionListener>();

	public constructor(name: string, public readonly entity: Entity, material: Partial<PhysicalMaterial>) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
		this.material = MergeWithDefault(defaultPhysicalMaterial, material);
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
		if (this.material.static) {
			this.angleForce = 0;
			this.lineForce.x = 0;
			this.lineForce.y = 0;
			return;
		}

		let m = this.Mass();
		let inertia = this.MomentOfInertia();

		this.angleVelocity = (this.angleVelocity + dt * this.angleForce / inertia) * (1 - this.material.angleFriction);
		this.entity.rotation += dt * this.angleVelocity;
		this.angleForce = 0;

		this.lineVelocity = this.lineVelocity.Add(this.lineForce.Mult(dt / m)).Mult(1 - this.material.lineFriction);
		this.entity.location = this.entity.location.Add(this.lineVelocity.Mult(dt));
		this.lineForce.x = 0;
		this.lineForce.y = 0;
	}

	public Hit(force: Point, point: Point) {
		this.lineForce = this.lineForce.Add(force);

		const delta = this.entity.location.Sub(point);
		const deltaLen = delta.Len();
		if (deltaLen < 1e-10) {
			return;
		}
		const deltaNorm = delta.Div(deltaLen);
		const lineForce = deltaNorm.Mult(deltaNorm.Dot(force));
		const angleForce = force.Sub(lineForce);

		const p = point.Add(angleForce);
		const p1 = point;
		const p2 = this.entity.location;
		const delta2 = p2.Sub(p1);
		const area = p2.x * p1.y - p2.y * p1.x;
		const value = delta2.y * p.x - delta2.x * p.y + area;

		this.angleForce += angleForce.Len() * deltaLen * Math.sign(value);
	}

	public Kick(force: Point) {
		if(force.Len() < 0.0000001)
			return;
		this.Hit(force, this.entity.location);
	};

	public TurnKick(force: number) {
		this.angleForce += force;
	};

	FromDelta(delta: any): void {
		this.lineVelocity = new Point(delta.lineVelocity.x, delta.lineVelocity.y);
		this.angleVelocity = delta.angleVelocity;
	}

	ToDelta(force: boolean): any {
		if (this.material.static) {
			return;
		}
		return {
			lineVelocity: this.lineVelocity,
			angleVelocity: this.angleVelocity
		}
	}
}

export abstract class PolygonBody extends Body
{
	protected abba = {p1: new Point(0, 0), p2: new Point(0, 0)};
	protected polygonPoints = new Array<Point>();
	protected momentOfInertia = 0;
	protected mass = 0;

	protected abstract RecalculatePolygonPoints(): void;
	protected abstract RecalculateMomentOfInertia(): void;

	protected RecalculateMass() {
		this.mass = this.Area() * this.material.density;
	}

	private RecalculateAbba() {
		this.abba.p1.x = this.abba.p1.y = Infinity;
		this.abba.p2.x = this.abba.p2.y = -Infinity;
		for(let i = 0; i < this.polygonPoints.length; ++i) {
			this.abba.p1.x = Math.min(this.abba.p1.x, this.polygonPoints[i].x);
			this.abba.p1.y = Math.min(this.abba.p1.y, this.polygonPoints[i].y);
			this.abba.p2.x = Math.max(this.abba.p2.x, this.polygonPoints[i].x);
			this.abba.p2.y = Math.max(this.abba.p2.y, this.polygonPoints[i].y);
		}
	}

	public Area(): number {
		let result = 0;
		const len = this.polygonPoints.length;
		for (let i = 0; i < len; ++i) {
			const p1 = this.polygonPoints[i];
			const p2 = this.polygonPoints[(i + 1) % len];
			result += p1.x * p2.y - p1.y * p2.x;
		}
		return result / 2;
	}

	public Abba() {
		return this.abba;
	}

	public Mass(): number {
		return this.mass;
	}

	public MomentOfInertia(): number {
		return this.momentOfInertia;
	}

	public PolygonPoints(): Point[] {
		return this.polygonPoints;
	}

	public Clear() {
		this.RecalculatePolygonPoints();
		this.RecalculateAbba();
		this.RecalculateMass();
		this.RecalculateMomentOfInertia();
	}

	public Map(p: Point): number {
		let dist = Infinity;
		for (let i = 0; i < this.polygonPoints.length; ++i) {
			const p1 = this.polygonPoints[i];
			const p2 = this.polygonPoints[(i + 1) % this.polygonPoints.length];
			const v = p2.Sub(p1);
			const d = p.Sub(p1);
			const q = (v.x * d.x + v.y * d.y) / (v.x * v.x + v.y * v.y);
			const pp = p.Sub(v.Mult(Math.min(Math.max(q, 0), 1)));
			dist = Math.min(dist, p1.Sub(pp).Len());
		}
		return dist;
	}
}

export class RectangleBody extends PolygonBody
{
	public constructor(name: string, entity: Entity, material: Partial<PhysicalMaterial>, public size: Size) {
		super(name, entity, material);
		this.Clear();
	}

	protected RecalculateMomentOfInertia(): void {
		const w = this.size.width;
		const h = this.size.height;
		this.momentOfInertia = this.material.density * w * h * (h * h + w * w) / 12;
	}

	protected RecalculatePolygonPoints(): void {
		let m = this.entity.Transform();
		let size = this.size;

		let points = [
			new Point(size.width / 2, size.height / 2),
			new Point(-size.width / 2, size.height / 2),
			new Point(-size.width / 2, -size.height / 2),
			new Point(size.width / 2, -size.height / 2)
		];

		for (let i = 0; i < 4; ++i) {
			points[i] = points[i].Transform(m);
		}

		this.polygonPoints = points;
	}

	public Area(): number {
		return this.size.Area();
	}

	public Map(p: Point): number {
		p = p.Transform(this.entity.InverseTransform());
		return new Point(
			Math.max(Math.abs(p.x) - this.size.width / 2, 0),
			Math.max(Math.abs(p.y) - this.size.height / 2, 0)
		).Len();
	}

	ToConstructor(): any[] {
		return [this.entity.Name, this.material, this.size]
	}
}

export class RegularPolygonBody extends PolygonBody
{
	public constructor(name: string, entity: Entity, material: Partial<PhysicalMaterial>, public radius: number, public vertexes: number) {
		super(name, entity, material);
		this.Clear();
	}

	protected RecalculateMomentOfInertia(): void {
		const angle = Math.PI / this.vertexes;
		const a = Math.cos(angle) * this.radius;
		const b = Math.sin(angle) * this.radius;
		this.momentOfInertia = this.material.density * a * b * (a * a + b * b / 3) * this.vertexes / 2;
	}

	protected RecalculatePolygonPoints(): void {
		let m = this.entity.Transform();
		let points = new Array<Point>();
		for (let i = 0; i < this.vertexes; ++i) {
			const angle = Math.PI * 2 * i / this.vertexes;
			points.push(new Point(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius).Transform(m));
		}
		this.polygonPoints = points;
	}

	public Area(): number {
		const a = Math.PI / this.vertexes;
		return this.radius * this.radius * this.vertexes * Math.sin(a) * Math.cos(a);
	}

	ToConstructor(): any[] {
		return [this.entity.Name, this.material, this.radius, this.vertexes]
	}
}
