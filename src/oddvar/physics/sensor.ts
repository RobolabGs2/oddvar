import { Point } from "../geometry";
import { RectangleBody, Body, PolygonBody } from "../physics/body";
import { Essence } from "../physics/essence";
import { IEntity } from "../world";


export abstract class Sensor extends Essence
{
	protected blacklist = new Map<Body, number>();


	public constructor(name: string, public readonly entity: IEntity) {
		super(name);
		entity.DeathSubscribe(() => this.Die());
	}

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

	FromDelta(delta: any): void {
	}

	ToDelta(force: boolean) {
		return null;
	}

	ToConstructor(): any[] {
		return [this.entity.Name];
	}
}


export class RaySensor extends Sensor
{
	public distance = Infinity;
	public observable: Body | null = null;

	private start = new Point(0, 0);
	private direction = new Point(1, 0);

	private TakePolygonBody(body: PolygonBody) {
		const points = body.PolygonPoints();
		const len = points.length;
		for(let i = 0; i < len; ++i) {
			if (this.TakeLineSegment(points[i], points[(i + 1) % len]))
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
		if (body instanceof(PolygonBody))
			return this.TakePolygonBody(body);
		throw new Error("unknown body");
	}
}
