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

export interface PolygonTexture extends Deadly {
	DrawPolygon(context: CanvasRenderingContext2D, polygon: Point[]): void;
}

export interface ColorSettings {
	fill?: Color
	stroke?: Color
	strokeWidth?: number
}

export interface ImageSource {
	GetImage(name: string): CanvasImageSource;
}

export class TexturesManager extends DeadlyWorld<Deadly> {
	constructor(private readonly imageSource: ImageSource, private readonly ctx: CanvasRenderingContext2D) {
		super();
	}
	Tick(dt: number): void { }
	CreateColoredTexture(name: string, colors: ColorSettings): ColoredTexture {
		return new ColoredTexture(name, colors)
	}
	/**
	 * 
	 * @param name 
	 * @param color цвет полосок
	 * @param size размер квадарата, диагональю которого будет одна полоска
	 * @param borderSize - если указан, будет квадратная рамка такого размера
	 */
	CreateHatchingTexture(name: string, color = "black", size = 21, borderSize = 0): HatchingTexture {
		this.ctx.clearRect(0, 0, Math.max(size, borderSize), Math.max(size, borderSize));
		this.ctx.canvas.width = this.ctx.canvas.height = size;
		this.ctx.lineCap = "square";
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		this.ctx.moveTo(size, 0);
		this.ctx.lineTo(0, size);
		this.ctx.stroke();
		this.ctx.beginPath();
		this.ctx.moveTo(-size, size);
		this.ctx.lineTo(size, -size);
		this.ctx.stroke();
		this.ctx.beginPath();
		this.ctx.moveTo(0, 2 * size);
		this.ctx.lineTo(2 * size, 0);
		this.ctx.stroke();
		const lines = new HatchingTexture(name, [color, size, borderSize], this.ctx.createPattern(this.ctx.canvas, "repeat")!);
		if (borderSize === 0) {
			return lines;
		}
		const cellSize = this.ctx.canvas.width = this.ctx.canvas.height = borderSize;
		this.ctx.save();
		lines.DrawRectangle(this.ctx, new Size(cellSize * 2, cellSize * 2));
		this.ctx.restore();
		this.ctx.strokeStyle = "black";
		this.ctx.lineWidth = 3;
		this.ctx.strokeRect(0, 0, cellSize, cellSize);
		const oneCellPattern = this.ctx.createPattern(this.ctx.canvas, "repeat")!;
		this.ctx.canvas.width = this.ctx.canvas.height = borderSize*11;
		return new HatchingTexture(name, [color, size, borderSize], oneCellPattern)
	}
	CreateRectanglePatternTexture(name: string, fill = "black", stroke = "black", size = 21): HatchingTexture {
		this.ctx.canvas.width = this.ctx.canvas.height = size;
		this.ctx.strokeStyle = stroke;
		this.ctx.fillStyle = fill;
		this.ctx.lineWidth = 1;
		this.ctx.fillRect(0, 0, size, size);
		this.ctx.strokeRect(0, 0, size, size);
		return new HatchingTexture(name, [fill, stroke, size], this.ctx.createPattern(this.ctx.canvas, "repeat")!)
	}
	CreatePatternTexture(name: string, imgName: string): PatternTexture {
		return new PatternTexture(name, imgName, this.ctx.createPattern(this.imageSource.GetImage(imgName), "repeat")!)
	}
	CreateImageTexture(name: string, imgName: string): ImageTexture {
		return new ImageTexture(name, imgName, this.imageSource.GetImage(imgName))
	}
}

type Color = string

interface ContextAction<T extends any[]> {
	(this: CanvasRenderingContext2D, ...args: T): void;
}

export abstract class StyledTexture extends StatelessDeadly implements RectangleTexture, CircleTexture, VectorTexture, PolygonTexture {
	public constructor(name: string) {
		super(name);
	}

	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		context.translate(-size.width / 2, -size.height / 2)
		this.draw(context, context.fillRect, context.strokeRect, 0, 0, size.width, size.height)
	}

	DrawCircle(context: CanvasRenderingContext2D, r: number): void {
		context.beginPath();
		context.arc(0, 0, r, 0, 2 * Math.PI);
		this.drawPath(context);
	}


	DrawPolygon(context: CanvasRenderingContext2D, poly: Point[]): void {
		if (poly.length == 0) {
			return;
		}
		context.beginPath();
		context.moveTo(poly[poly.length - 1].x, poly[poly.length - 1].y);
		for (let i = 0; i < poly.length; ++i) {
			context.lineTo(poly[i].x, poly[i].y);
		}
		context.closePath();
		this.drawPath(context);
	}

	DrawText(context: CanvasRenderingContext2D, text: string, fontSize: number): void {
		context.textAlign = "center";
		context.textBaseline = "bottom";
		const dFont = context.font;
		context.font = `${fontSize}px Arial`
		const metricst = context.measureText(text);
		this.draw(context, context.fillText, context.strokeText, text, 0, metricst.actualBoundingBoxAscent/2);
		context.font = dFont;
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

	protected abstract setFillStyle(context: CanvasRenderingContext2D): boolean;
	protected abstract setStrokeStyle(context: CanvasRenderingContext2D): boolean;

	private draw<T extends any[]>(
		context: CanvasRenderingContext2D,
		fill: ContextAction<T>, stroke: ContextAction<T>,
		// точный тип параметров функции автовыведется
		...a: T
	) {
		if (this.setFillStyle(context))
			fill.apply(context, a)
		if (this.setStrokeStyle(context))
			stroke.apply(context, a);
	}

	private drawPath(context: CanvasRenderingContext2D): void {
		this.draw<[]>(context, context.fill, context.stroke);
	}

	abstract ToConstructor(): any[];
}

export class ColoredTexture extends StyledTexture {
	protected setFillStyle(context: CanvasRenderingContext2D): boolean {
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			return true;
		}
		return false;
	}

	protected setStrokeStyle(context: CanvasRenderingContext2D): boolean {
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.lineWidth = this.settings.strokeWidth || 2;
			return true;
		}
		return false;
	}

	public constructor(name: string, readonly settings: ColorSettings = { fill: "black" }) {
		super(name);
	}

	ToConstructor(): any[] {
		return [this.settings];
	}
}

export class PatternTexture extends StyledTexture {
	protected setFillStyle(context: CanvasRenderingContext2D): boolean {
		context.fillStyle = this.pattern;
		return true;
	}

	protected setStrokeStyle(context: CanvasRenderingContext2D): boolean {
		context.strokeStyle = this.pattern;
		return true;
	}

	public constructor(name: string, private url: string, private readonly pattern: CanvasPattern) {
		super(name);
	}

	ToConstructor(): any[] {
		return [this.url];
	}
}
export class HatchingTexture extends StyledTexture {
	protected setFillStyle(context: CanvasRenderingContext2D): boolean {
		context.fillStyle = this.pattern;
		return true;
	}

	protected setStrokeStyle(context: CanvasRenderingContext2D): boolean {
		context.strokeStyle = this.pattern;
		return true;
	}

	public constructor(name: string, readonly params: any[], private readonly pattern: CanvasPattern) {
		super(name);
	}

	ToConstructor(): any[] {
		return this.params;
	}
}

export class RectanglePatternTexture extends HatchingTexture {
	public constructor(name: string, params: any[], pattern: CanvasPattern) {
		super(name, params, pattern);
	}
}

export class ImageTexture extends StatelessDeadly implements RectangleTexture {
	public constructor(name: string, private url: string, private readonly img: CanvasImageSource) {
		super(name);
	}

	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		// TODO: вписывать вместо растягивания
		context.drawImage(this.img, -size.width / 2, -size.height / 2, size.width, size.height);
	}

	ToConstructor(): any[] {
		return [this.url];
	}
}