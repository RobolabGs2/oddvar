import { Deadly, DeadlyWorld } from "base"
import { Entity } from "world"
import { Matrix, Point, Size } from "geometry";
import { Body, RectangleBody } from "physics/body";
import { RaySensor } from "physics/sensor";
import { ColoredTexture, RectangleTexture } from "graphics/texture";

function TransformContext(c: CanvasRenderingContext2D, m: Matrix) {
	c.transform(
		m.Get(0, 0), m.Get(0, 1),
		m.Get(1, 0), m.Get(1, 1),
		m.Get(2, 0), m.Get(2, 1));
}

export abstract class Avatar extends Deadly {
	public constructor() {
		super();
	}
	public abstract Tick(dt: number, context: CanvasRenderingContext2D): void;
}

export abstract class DeadlyAvatar extends Deadly {
	public constructor(deadly: Deadly) {
		super();
		deadly.DeathSubscribe(() => this.Die())
	}
}


export class EntityAvatar extends DeadlyAvatar {
	public constructor(
		public readonly entity: Entity,
		public readonly size: Size,
		public readonly texture: RectangleTexture
	) {
		super(entity);
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.entity.Transform());
		this.texture.DrawRectangle(context, this.size);
	}
}



interface Pointable {
	Point(): Point
}

function DrawVector(context: CanvasRenderingContext2D, vec: Point) {
	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(vec.x, vec.y)
	context.stroke();
	const len = vec.Len()
	const norm = vec.Div(len);
	TransformContext(context, Matrix.RotationCosSin(norm.x, norm.y).Mult(Matrix.Translate(vec)))
	context.beginPath()
	const dy = context.lineWidth + 2;
	const dx = dy + 4;
	context.moveTo(-dx, -dy);
	context.lineTo(0, 0);
	context.lineTo(-dx, dy)
	context.stroke();
	context.fillText(len.toFixed(2), 0, 0);
}

export class DebugBodyAvatar extends DeadlyAvatar {
	public constructor(public readonly body: Body) {
		super(body);
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		context.fillStyle = "blue";
		context.strokeStyle = "grey";
		context.lineWidth = 3;
		context.translate(this.body.X, this.body.Y);
		[this.body.lineVelocity].forEach((vec) => {
			context.save();
			DrawVector(context, vec);
			context.restore();
		})
	}
}

export class DebugRaySensor extends DeadlyAvatar {
	public constructor(public readonly ray: RaySensor) {
		super(ray);
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		context.fillStyle = "#770";
		context.strokeStyle = "#770";
		context.lineWidth = 3;
		TransformContext(context, this.ray.entity.Transform());
		context.save();
		DrawVector(context, new Point(this.ray.distance, 0));
		context.restore();
	}
}

export class PointAvatar extends DeadlyAvatar {
	private texture = new ColoredTexture({ fill: "blue" })
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		const p = this.parent.Point();
		context.translate(p.x, p.y)
		this.texture.DrawRectangle(context, new Size(5, 5));
	}
	public constructor(public readonly parent: Deadly & Pointable) {
		super(parent);

	}
}

export class RectangleBodyAvatar extends DeadlyAvatar {
	public constructor(
		public readonly body: RectangleBody,
		private readonly texture: RectangleTexture
	) {
		super(body)
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.body.entity.Transform());
		this.texture.DrawRectangle(context, this.body.size);
	}
}

export class Graphics extends DeadlyWorld<Avatar>
{
	private readonly context: CanvasRenderingContext2D;

	constructor(private canvas: HTMLCanvasElement) {
		super();
		this.context = this.canvas.getContext("2d")!
	}

	public Tick(dt: number) {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.mortals.forEach(e => {
			this.context.save();
			e.Tick(dt, this.context);
			this.context.restore();
		})
	}

	public CreateEntityAvatar(entity: Entity, size: Size, texture: RectangleTexture): EntityAvatar {
		return this.AddDeadly(new EntityAvatar(entity, size, texture));
	}

	public CreateRectangleBodyAvatar(body: RectangleBody, texture: RectangleTexture): RectangleBodyAvatar {
		return this.AddDeadly(new RectangleBodyAvatar(body, texture));
	}

	public CreatePointAvatar(parent: Deadly & Pointable): PointAvatar {
		return this.AddDeadly(new PointAvatar(parent));
	}

	public CreateDebugBodyAvatar(body: Body) {
		return this.AddDeadly(new DebugBodyAvatar(body));
	}

	public CreateDebugRaySensor(ray: RaySensor) {
		return this.AddDeadly(new DebugRaySensor(ray));
	}
}
