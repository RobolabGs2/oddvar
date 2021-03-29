import { Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { Entity } from "../oddvar/world"
import { Player } from '../oddvar/players';
import { PhysicControlled } from '../oddvar/controller';
import { GameLogic } from '../oddvar/manager';
import { IBody, PhysicalMaterial } from '../oddvar/physics/body';
import { Labirint } from './labirint';


export type WallCreator = (center: Point, rotation: number, size: Size, material?: Partial<PhysicalMaterial>) => void;

export type MapCreator = (oddvar: Oddvar, createWall: WallCreator) => void;

export const TestMap: MapCreator = (oddvar, createWall) => {
	{
		const testEntityTexture = oddvar.Get("TexturesManager").CreateColoredTexture("limestroke", ({ stroke: "lime" }));
		const e1 = oddvar.Get("World").CreateEntity("Physics test entity", new Point(100, 200));
		const b1 = oddvar.Get("Physics").CreateRectangleBody("Physics test body", e1, { lineFriction: 0, angleFriction: 0 }, new Size(10, 10))
		b1.lineVelocity.x = 10;
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("Physics test avatar", b1, testEntityTexture)
		const e2 = oddvar.Get("World").CreateEntity("Physics test entity2", new Point(200, 200), 1);
		const b2 = oddvar.Get("Physics").CreateRectangleBody("Physics test body2", e2, { lineFriction: 0, angleFriction: 0 }, new Size(10, 10))
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("Physics test avatar2", b2, testEntityTexture)
	}
	{
		const borderSize = new Size(250, 25);
		createWall(new Point(100, 100), -Math.PI / 4, borderSize);
		createWall(new Point(300, 100), Math.PI / 4, borderSize);
		createWall(new Point(100, 300), Math.PI / 4, borderSize);
		createWall(new Point(300, 300), -Math.PI / 4, borderSize, { lineFriction: 0.1, angleFriction: 0.1 });
	}
}

export const LabirintMap = (labirint: Labirint, size: Size, shift: Point, oddvar: Oddvar, createWall: WallCreator) => {
	for (let i = 0; i < labirint.width; ++i) {
		let last = 0;
		for (let j = 0; j < labirint.height; ++j) {
			if (!labirint.get(i, j)) {
				if (last < j) {
					createWall(new Point((i + 0.5) * size.width + shift.x, ((j + last - 1) / 2 + 0.5) * size.height + shift.y), 0,
							new Size(size.width, (j - last) * size.height));
				}
				last = j + 1;
			}
		}
		if (last < labirint.height) {
			createWall(new Point( (i + 0.5) * size.width + shift.x, ((labirint.height + last - 1) / 2 + 0.5) * size.height + shift.y), 0,
					new Size(size.width, (labirint.height - last) * size.height));
		}
	}
}

export const RandomLabirint: MapCreator = (oddvar, createWall) =>LabirintMap(Labirint.Generate(50, 50).Or(Labirint.Frame(50, 50, 3)), new Size(10, 10), new Point(0, 0), oddvar, createWall)

export class CollectingSquaresGame implements GameLogic {
	private usersThings = new Map<number, { entity: Entity, controller: PhysicControlled, body: IBody }>();
	private targetPoint: Entity;
	private readonly size = new Size(20, 20);

	constructor(private oddvar: Oddvar, mapCreator: MapCreator = RandomLabirint, readonly debug = false) {
		const targetSize = new Size(10, 10)
		this.targetPoint = oddvar.Get("World").CreateEntity("targetPoint", new Point(0, 0))
		const targetBody = oddvar.Get("Physics").CreateRectangleBody("targetRectangleBody", this.targetPoint, { lineFriction: 1, angleFriction: 0 }, targetSize);
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("targetEntityAvatar", targetBody, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }));
		targetBody.AddCollisionListener((self, b) => this.usersThings.forEach(v => {
			if (v.body != b)
				return;
			++v.controller.score;
			this.RelocatePoint();
		}))
		mapCreator(oddvar, this.createWall.bind(this));
		this.RelocatePoint();
	}

	private wallCounter = 0;
	private borderTexture = this.oddvar.Get("TexturesManager").CreatePatternTexture("bricks", "bricks");
	private borderTextureDebug = this.oddvar.Get("TexturesManager").CreateColoredTexture("debug", {stroke: "red"});
	private createWall(center: Point, rotation: number, size: Size, material: Partial<PhysicalMaterial> = { static: true, lineFriction: 0.1, angleFriction: 0.1 }) {
		const id = this.wallCounter++;
		const border = this.oddvar.Get("World").CreateEntity(`wall ${id}`, center, rotation);
		const body = this.oddvar.Get("Physics").CreateRectangleBody(`wall ${id} body`, border, material, size)
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar`, body, this.borderTexture)
		if (this.debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar2`, body, this.borderTextureDebug)

	}

	private RelocatePoint() {
		this.targetPoint.location = this.GenerateInconflictPoint(10);
	}

	Tick(dt: number): void {
	}

	private GenerateInconflictPoint(distance: number): Point {
		let p = new Point(Math.random() * 500, Math.random() * 500);
		if (this.oddvar.Get("Physics").Map(p) < distance)
			return this.GenerateInconflictPoint(distance);
		return p;
	}


	textures = [
		this.oddvar.Get("TexturesManager").CreateImageTexture("skull", "skull"),
		this.oddvar.Get("TexturesManager").CreateImageTexture("duck_32", "duck_32"),
		this.oddvar.Get("TexturesManager").CreateImageTexture("duck_16", "duck_16"),
	]
	AddUser(player: Player): void {
		const e = this.oddvar.Get("World").CreateEntity(`test entity ${player.id}`, this.GenerateInconflictPoint(14));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { stroke: currentColor });

		const b = this.oddvar.Get("Physics").CreateRectangleBody(`test body ${player.id}`, e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size)
		if(this.debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`test avatar ${player.id}_back`, b, texture);
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`test avatar ${player.id}`, b, this.textures[((Math.random()*7)|0)%3]);

		const c = this.oddvar.Get("Controller").CreatePhysicControlled(`test physic controlled ${player.id}`, b, player);
		this.oddvar.Get("Graphics").CreatePhysicControlledAvatar(`test avatar ${player.id} scode`, c, currentColor)
		this.usersThings.set(player.id, { entity: e, controller: c, body: b });
		player.DeathSubscribe(p => {
			e.Die();
			this.usersThings.delete(player.id);``
		})
	}
}

const PacManQ = [
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
	[1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
	[1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	[1, 1, 0, 0, 1, 1, 0, 1, 1, 0],
	[1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
	[1, 1, 0, 1, 0, 1, 1, 1, 0, 0],
	[1, 0, 0, 1, 0, 0, 1, 1, 0, 1],
	[1, 0, 1, 1, 0, 1, 1, 1, 0, 0],
	[1, 0, 1, 1, 0, 0, 0, 0, 0, 1],
]

const PacMan: Labirint = (() => {
	const map = new Labirint(PacManQ.length*2, PacManQ.length*2)
	const a = PacManQ.length;
	for(let i = 0; i<2; i++) {	
		for(let j = 0; j<2; j++) {	
			PacManQ.forEach((l, _i) => {
				l.forEach((cell, _j) => {
					const y = (i%2) ? 2*a-_i-1 : a*i+_i
					const x = (j%2) ? 2*a-_j-1 : a*j+_j
					map.set(x, y, cell == 1);
				})
			})
		}
	}
	return map;
})()

export const PacManLikeLabirint: MapCreator = (oddvar, createWall) =>LabirintMap(PacMan, new Size(25, 25), new Point(0, 0), oddvar, createWall)
