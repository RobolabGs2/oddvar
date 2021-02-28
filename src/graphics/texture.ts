import { Size } from "geometry";
import * as HTML from "html";

export interface CircleTexture {
	DrawCircle(context: CanvasRenderingContext2D, radius: number): void;
}

type Color = string

export interface RectangleTexture {
	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void;
}

export interface ColorSettings {
	fill?: Color
	stroke?: Color
}

export class ColoredTexture implements RectangleTexture {
	public constructor(private settings: ColorSettings = { fill: "black" }) { }
	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			context.fillRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.strokeRect(-size.width / 2, -size.height / 2, size.width, size.height);
		}
	}
	DrawCircle(context: CanvasRenderingContext2D, radius: number): void {
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * Math.PI);
		if (this.settings.fill) {
			context.fillStyle = this.settings.fill;
			context.fill();
		}
		if (this.settings.stroke) {
			context.strokeStyle = this.settings.stroke;
			context.stroke();
		}
	}
}

export class ImageTexture implements RectangleTexture {
	private img?: ImageBitmap
	public constructor(img: string) { 
		const self = this;
		HTML.CreateElement(
			"img",
			HTML.AddEventListener("load", function(){
				createImageBitmap(this as HTMLImageElement).
				then(bimao => self.img = bimao)
			})
		)
	}
	DrawRectangle(context: CanvasRenderingContext2D, size: Size): void {
		if(this.img)
			context.drawImage(this.img, -size.width/2, -size.height/2, size.width, size.height)
	}
}