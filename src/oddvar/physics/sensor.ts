import { Point } from "geometry";
import { Body, RectangleBody } from "physics/body";
import { Essence } from "physics/essence";

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
