import { Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar";
import { PhysicalMaterial } from '../../oddvar/physics/body';
import { StyledTexture } from '../../oddvar/textures';

export type WallCreator = (center: Point, rotation: number, size: Size, material?: Partial<PhysicalMaterial>) => void;

export class WallManager {
	constructor(readonly oddvar: Oddvar, textureName = "bricks", readonly debug = false) {
		this.borderTexture = this.oddvar.Get("TexturesManager").CreatePatternTexture("wall", textureName);
	}
	private wallCounter = 0;
	public borderTexture: StyledTexture;
	private borderTextureDebug = this.oddvar.Get("TexturesManager").CreateColoredTexture("debug", { stroke: "red", strokeWidth: 0.5 });
	public newWall(center: Point, rotation: number, size: Size, material: Partial<PhysicalMaterial> = { static: true, lineFriction: 1, angleFriction: 1 }) {
		const id = this.wallCounter++;
		const border = this.oddvar.Get("World").CreateEntity(`wall ${id}`, center, rotation);
		const body = this.oddvar.Get("Physics").CreateRectangleBody(`wall ${id} body`, border, material, size);
		this.oddvar.Get("Graphics").CreatePolygonBodyAvatar(`wall ${id} avatar`, body, this.borderTexture);
		if (this.debug)
			this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar debug`, body, this.borderTextureDebug);
	}

	public get creator(): WallCreator {
		return this.newWall.bind(this);
	}

}
