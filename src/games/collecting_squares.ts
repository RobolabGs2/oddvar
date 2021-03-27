import { Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { Entity } from "../oddvar/world"
import { Player } from '../oddvar/players';
import { PhysicControlled } from '../oddvar/controller';
import { GameLogic } from '../oddvar/manager';
import { IBody, PhysicalMaterial } from '../oddvar/physics/body';


export class CollectingSquaresGame implements GameLogic {
	private usersThings = new Map<number, { entity: Entity, controller: PhysicControlled, body: IBody }>();
	private targetPoint: Entity;
	private readonly size = new Size(20, 20);

	constructor(private oddvar: Oddvar) {
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
		{
			const testEntityTexture = this.oddvar.Get("TexturesManager").CreateColoredTexture("limestroke", ({ stroke: "lime" }));
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
			this.createWall(new Point(100, 100), -Math.PI / 4, borderSize);
			this.createWall(new Point(300, 100), Math.PI / 4, borderSize);
			this.createWall(new Point(100, 300), Math.PI / 4, borderSize);
			this.createWall(new Point(300, 300), -Math.PI / 4, borderSize, { lineFriction: 0.1, angleFriction: 0.1 });
		}
		this.RelocatePoint();
	}

	private wallCounter = 0;
	private borderTexture = this.oddvar.Get("TexturesManager").CreatePatternTexture("bricks", "bricks");
	private createWall(center: Point, rotation: number, size: Size, material: Partial<PhysicalMaterial> = { static: true, lineFriction: 0.1, angleFriction: 0.1 }) {
		const id = this.wallCounter++;
		const border = this.oddvar.Get("World").CreateEntity(`wall ${id}`, center, rotation);
		const body = this.oddvar.Get("Physics").CreateRectangleBody(`wall ${id} body`, border, material, size)
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar`, body, this.borderTexture)
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

	AddUser(player: Player): void {
		const e = this.oddvar.Get("World").CreateEntity(`test entity ${player.id}`, this.GenerateInconflictPoint(20));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { fill: currentColor });

		const b = this.oddvar.Get("Physics").CreateRectangleBody(`test body ${player.id}`, e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size)
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`test avatar ${player.id}`, b, texture);

		const c = this.oddvar.Get("Controller").CreatePhysicControlled(`test physic controlled ${player.id}`, b, player);
		this.oddvar.Get("Graphics").CreatePhysicControlledAvatar(`test avatar ${player.id} scode`, c, currentColor)
		this.usersThings.set(player.id, { entity: e, controller: c, body: b });
		player.DeathSubscribe(p => {
			e.Die();
			this.usersThings.delete(player.id);
		})
	}
}
