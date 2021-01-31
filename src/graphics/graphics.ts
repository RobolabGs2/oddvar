import { Deadly, DeadlyWorld } from "../base"
import { Entity } from "../world"
import { Matrix, Size } from "../geometry";
import { Body, RectangleBody } from "../physics";

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

export interface RectangleTexture {
	Draw(context: CanvasRenderingContext2D, size: Size): void;
}

export class EntityAvatar extends Avatar {
	public constructor(public readonly entity: Entity, public readonly size: Size, public readonly texture: RectangleTexture) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.entity.Transform());
		this.texture.Draw(context, this.size);
	}
}

export interface ColorSettings {
	fill?: string
	stroke?: string
}

export class RectangleBodyAvatar extends EntityAvatar {
	public constructor(public readonly body: RectangleBody, texture: RectangleTexture) {
		super(body.entity, body.size, texture)
	}
}

export class RectangleTexture implements RectangleTexture {
	public constructor(private settings: ColorSettings = { fill: "black" }) {
	}

	public Draw(context: CanvasRenderingContext2D, size: Size): void {
		if(this.settings.fill) {
			context.fillStyle = this.settings.fill;
			context.fillRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
		if(this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
		
	}
}

export class Graphics extends DeadlyWorld<Avatar>
{
	private canvas = document.createElement("canvas");
	public readonly context: CanvasRenderingContext2D;

	constructor(parent: HTMLElement = document.body) {
		super();
		this.canvas.width = 500;
		this.canvas.height = 500;
		this.context = this.canvas.getContext("2d")!
		parent.appendChild(this.canvas);
	}

	public Tick(dt: number) {
		this.context.clearRect(0, 0, 500, 500);
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
}
