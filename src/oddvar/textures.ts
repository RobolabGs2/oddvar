import { Deadly, DeadlyWorld, StatelessDeadly } from "./base";
import { Size } from "./geometry";

type Color = string

export interface ColorSettings {
	fill?: Color
	stroke?: Color
}

export class ColoredTexture extends StatelessDeadly implements RectangleTexture, CircleTexture {
	public constructor(name: string, private settings: ColorSettings = { fill: "black" }) {
		super(name);
	}

	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		this.draw(
			context,
			() => context.fillRect(-size.width / 2, -size.height / 2, size.width, size.height),
			() => context.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height)
		)
	}

	DrawCircle(context: CanvasRenderingContext2D, r: number): void {
		context.beginPath();
		context.arc(0, 0, r, 0, 2*Math.PI);
		this.draw(
			context,
			() => context.fill(),
			() => context.stroke()
		)
	}

	private draw(context: CanvasRenderingContext2D, fill: () => void, stroke: () => void) {
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			fill()
		}
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.lineWidth = 2;
			stroke();
		}
	}

	ToConstructor(): any[] {
		return [ this.settings ];
	}
}

export interface RectangleTexture extends Deadly {
	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void;
}

export interface CircleTexture extends Deadly {
	DrawCircle(context: CanvasRenderingContext2D, r: number): void;
}


export class TexturesManager extends DeadlyWorld<Deadly> {
	Tick(dt: number): void {}
	CreateColoredTexture(name: string, colors: ColorSettings): ColoredTexture {
		return new ColoredTexture(name, colors)
	}
}