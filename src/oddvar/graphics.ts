import { Deadly, DeadlyWorld } from "./base"
import { Entity } from "./world"
import { Matrix, Point, Size } from "./geometry";


function TransformContext(c: CanvasRenderingContext2D, m: Matrix) {
	c.transform(
		m.Get(0, 0), m.Get(0, 1),
		m.Get(1, 0), m.Get(1, 1),
		m.Get(2, 0), m.Get(2, 1));
}


export abstract class DeadlyAvatar extends Deadly {
	public constructor(name: string, deadly: Deadly) {
		super(name);
		deadly.DeathSubscribe(() => this.Die())
	}
	public abstract Tick(dt: number, context: CanvasRenderingContext2D): void;
}

export interface Texture {
	Draw(context: CanvasRenderingContext2D): void;
}

// export interface class RectangleTexture {
// 	interface Draw(context: CanvasRenderingContext2D, size: Size): void;
// }

export class EntityAvatar extends DeadlyAvatar {
	public constructor(name: string, public readonly entity: Entity, public readonly size: Size, public readonly texture: RectangleTexture) {
		super(name, entity);
	}

	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.entity.Transform());
		this.texture.Draw(context, this.size);
	}

	FromDelta(delta: any): void {
	}
	
	ToDelta(force: boolean): any {
		return undefined;
	}

	ToConstructor(): any[] {
		return [ this.entity.Name, this.size, this.texture.ToConstructor() ];
	}
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
	const dy = context.lineWidth+2;
	const dx = dy+4;
	context.moveTo(-dx, -dy);
	context.lineTo(0, 0);
	context.lineTo(-dx, dy)
	context.stroke();
	context.fillText(len.toFixed(2), 0, 0);
}


type Color = string

export interface ColorSettings {
	fill?: Color
	stroke?: Color
}


export class RectangleTexture { //implements RectangleTexture {
	public constructor(private settings: ColorSettings = { fill: "black" }) {
	}

	public Draw(context: CanvasRenderingContext2D, size: Size): void {
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			context.fillRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
	}

	ToConstructor() {
		return { settings: this.settings };
	}
}

export class Graphics extends DeadlyWorld<DeadlyAvatar>
{
	constructor(private readonly context: CanvasRenderingContext2D) {
		super();
	}

	public Tick(dt: number) {
		this.context.clearRect(0, 0, 500, 500);
		this.mortals.forEach(e => {
			this.context.save();
			e.Tick(dt, this.context);
			this.context.restore();
		})
	}

	public CreateEntityAvatar(name: string, entity: Entity, size: Size, texture: RectangleTexture): EntityAvatar {
		return this.AddDeadly(new EntityAvatar(name, entity, size, texture));
	}
}
