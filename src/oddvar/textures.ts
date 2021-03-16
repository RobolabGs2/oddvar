import { Deadly, DeadlyWorld, StatelessDeadly } from "./base";
import { Matrix, Point, Size } from "./geometry";

export function TransformContext(c: CanvasRenderingContext2D, m: Matrix) {
	c.transform(
		m.Get(0, 0), m.Get(0, 1),
		m.Get(1, 0), m.Get(1, 1),
		m.Get(2, 0), m.Get(2, 1));
}

export interface RectangleTexture extends Deadly {
	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void;
}

export interface CircleTexture extends Deadly {
	DrawCircle(context: CanvasRenderingContext2D, r: number): void;
}

export interface VectorTexture extends Deadly {
	DrawVector(context: CanvasRenderingContext2D, v: Point): void;
}

export interface ColorSettings {
	fill?: Color
	stroke?: Color
}

export class TexturesManager extends DeadlyWorld<Deadly> {
	Tick(dt: number): void { }
	CreateColoredTexture(name: string, colors: ColorSettings): ColoredTexture {
		return new ColoredTexture(name, colors)
	}
}

type Color = string

interface ContextAction<T extends any[]> {
	(this: CanvasRenderingContext2D, ...args: T): void;
}

export class ColoredTexture extends StatelessDeadly implements RectangleTexture, CircleTexture, VectorTexture {
	public constructor(name: string, private settings: ColorSettings = { fill: "black" }) {
		super(name);
	}

	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		this.draw(context, context.fillRect, context.strokeRect,
			-size.width / 2, -size.height / 2, size.width, size.height)
	}

	DrawCircle(context: CanvasRenderingContext2D, r: number): void {
		context.beginPath();
		context.arc(0, 0, r, 0, 2 * Math.PI);
		this.drawPath(context);
	}

	DrawVector(context: CanvasRenderingContext2D, vec: Point): void {
		context.beginPath();
		context.moveTo(0, 0);
		context.lineTo(vec.x, vec.y)
		this.drawPath(context);
		const len = vec.Len()
		const norm = vec.Div(len);
		TransformContext(context, Matrix.RotationCosSin(norm.x, norm.y).Mult(Matrix.Translate(vec)))
		context.beginPath()
		const dy = context.lineWidth + 2;
		const dx = dy + 4;
		context.moveTo(-dx, -dy);
		context.lineTo(0, 0);
		context.lineTo(-dx, dy)
		this.drawPath(context);
		context.fillText(len.toFixed(2), 0, 0);
	}

	private draw<T extends any[]>(
		context: CanvasRenderingContext2D,
		fill: ContextAction<T>, stroke: ContextAction<T>,
		// точный тип параметров функции автовыведется
		...a: T
	) {
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			fill.apply(context, a)
		}
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.lineWidth = 2;
			stroke.apply(context, a);
		}
	}

	private drawPath(context: CanvasRenderingContext2D): void {
		this.draw<[]>(context, context.fill, context.stroke);
	}

	ToConstructor(): any[] {
		return [this.settings];
	}
}
