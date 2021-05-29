import { Deadly, DeadlyWorld } from "../base"
import { Entity, IEntity } from "../world"
import { Point, Size } from "../geometry";
import { RectangleBody, Body, PhysicalMaterial, PolygonBody, RegularPolygonBody } from "./body";
import { Essence } from "./essence";
import { RaySensor, Sensor } from "./sensor";


export class Physics extends DeadlyWorld<Essence>
{
	private bodies = new Array<Body>();
	public sensors = new Set<Sensor>();

	public Tick(dt: number) {
		this.Sort();

		for (let i = 0; i < this.bodies.length; ++i) {
			let b1 = this.bodies[i];
			let abba1 = b1.Abba();

			this.sensors.forEach(s => s.Take(b1));

			for (let j = i + 1; j < this.bodies.length; ++j) {
				let b2 = this.bodies[j];
				let abba2 = b2.Abba();
				if (abba1.p2.x < abba2.p1.x)
					break;
				if (abba1.p1.y > abba2.p2.y
					|| abba1.p2.y < abba2.p1.y
					|| b1.material.static && b2.material.static
					|| (b1.material.layers & b2.material.layers) === 0)
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
		this.Clear();
	}

	private Intersect(b1: Body, b2: Body): boolean {
		if (b1 instanceof (PolygonBody))
			if (b2 instanceof (PolygonBody))
				return this.IntersectPolygonPolygon(b1, b2);
		throw new Error("unknown body");
	}

	private IntersectPolygonPolygon(b1: PolygonBody, b2: PolygonBody): boolean {
		const base1 = b1.PolygonPoints();
		const base2 = b2.PolygonPoints();
		const b1b2 = b2.entity.location.Sub(b1.entity.location);
		let result = false;
		for (let i = 0; i < base1.length; ++i) {
			let p = base1[i];
			let intersect = this.IntersectPointPoly(p, base2);
			if (intersect.intersect) {
				result = true;
				const dv = b2.GetVelocity(p).Sub(b1.GetVelocity(p));
				if (intersect.nearNorm.Dot(dv) < 0)
					continue;
				const k = 4000;
				const power = k * Math.min(b1.Mass(), b2.Mass()) * Math.pow(intersect.nearDist, 0.5) * (intersect.nearNorm.Dot(b1b2) > 0 ? -1 : 1);
				b1.Hit(intersect.nearNorm.Mult(power), p);
				b2.Hit(intersect.nearNorm.Mult(-power), p);
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

	public Map(p: Point, layers: number = -1): number {
		let min = Infinity;
		this.bodies.filter(b => (b.material.layers & layers) != 0).forEach(b => min = Math.min(b.Map(p), min));
		return min;
	}

	private AddSensor<T extends Sensor>(sensor: T) {
		this.sensors.add(sensor);
		sensor.DeathSubscribe(s => {
			this.sensors.delete(sensor);
		});
		return sensor
	}

	public CreateRectangleBody(name: string, e: Entity, material: Partial<PhysicalMaterial>, size: Size) {
		return this.AddBody(this.AddDeadly(new RectangleBody(name, e, material, size)));
	}

	public CreateRegularPolygonBody(name: string, e: Entity, material: Partial<PhysicalMaterial>, radius: number, vertexes: number) {
		return this.AddBody(this.AddDeadly(new RegularPolygonBody(name, e, material, radius, vertexes)));
	}

	public CreateRaySensor(name: string, e: IEntity) {
		return this.AddSensor(this.AddDeadly(new RaySensor(name, e)));
	}
}
