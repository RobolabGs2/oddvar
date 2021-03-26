import { Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { Entity } from "../oddvar/world"
import { Player } from '../oddvar/players';
import { ControlledWalker, PhysicControlled } from '../oddvar/controller';
import { GameLogic } from '../oddvar/manager';
import { IBody } from 'oddvar/physics/body';


export class TestGamelogic implements GameLogic {
	private usersThings = new Map<number, { entity: Entity, controller: PhysicControlled, body: IBody }>();
	private targetPoint: Entity;
	private readonly size = new Size(20, 20);

	constructor(private oddvar: Oddvar) {
		const targetSize = new Size(10, 10)
		this.targetPoint = oddvar.Add("World").CreateEntity("targetPoint", new Point(0, 0))
		oddvar.Add("Graphics").CreateRectangleEntityAvatar("targetEntityAvatar", this.targetPoint, targetSize, this.oddvar.Add("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }));
		const targetBody = oddvar.Add("Physics").CreateRectangleBody("targetRectangleBody", this.targetPoint, { lineFriction: 1, angleFriction: 0}, targetSize);
		targetBody.AddCollisionListener((self, b) => this.usersThings.forEach(v => {
			if (v.body != b)
				return;
			++v.controller.score;
			this.RelocatePoint();
		}))
		{
			const e = oddvar.Add("World").CreateEntity("Physics test entity", new Point(100, 200));
			oddvar.Add("Physics").CreateRectangleBody("Physics test body", e, {lineFriction: 0, angleFriction: 0}, new Size(10, 10)).lineVelocity.x = 10
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar", e, new Size(10, 10), this.oddvar.Add("TexturesManager").CreateColoredTexture("limestroke2", ({ stroke: "lime" })))
			const e2 = oddvar.Add("World").CreateEntity("Physics test entity2", new Point(200, 200), 1);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body2", e2, {lineFriction: 0, angleFriction: 0}, new Size(10, 10))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar2", e2, new Size(10, 10), this.oddvar.Add("TexturesManager").CreateColoredTexture("limestroke3", ({ stroke: "lime" })))
		}
		{
			const borderSize = new Size(250, 25);
			const borderTexture = this.oddvar.Add("TexturesManager").CreateColoredTexture("border color", ({ stroke: "black" }));
			const border1 = oddvar.Add("World").CreateEntity("Physics test entity border1", new Point(100, 100), -Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border1", border1, {static: true, lineFriction: 0.1, angleFriction: 0.1}, borderSize)
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border1", border1, borderSize, borderTexture)

			const border2 = oddvar.Add("World").CreateEntity("Physics test entity border2", new Point(300, 100), Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border2", border2, {static: true, lineFriction: 0.1, angleFriction: 0.1}, borderSize)
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border2", border2, borderSize, borderTexture)
			
			const border3 = oddvar.Add("World").CreateEntity("Physics test entity border3", new Point(100, 300), Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border3", border3, {static: true, lineFriction: 0.1, angleFriction: 0.1}, borderSize)
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border3", border3, borderSize, borderTexture)
			
			const border4 = oddvar.Add("World").CreateEntity("Physics test entity border4", new Point(300, 300), -Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border4", border4, {lineFriction: 0.1, angleFriction: 0.1}, borderSize)
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border4", border4, borderSize, borderTexture)
		}
		this.RelocatePoint();
	}

	private RelocatePoint() {
		this.targetPoint.location = this.GenerateInconflictPoint(10);
	}

	Tick(dt: number): void {
	}

	private GenerateInconflictPoint(distance: number): Point {
		let p = new Point(Math.random() * 500, Math.random() * 500);
		if (this.oddvar.Add("Physics").Map(p) < distance)
			return this.GenerateInconflictPoint(distance);
		return p;
	}

	AddUser(player: Player): void {
		const e = this.oddvar.Add("World").CreateEntity(`test entity ${player.id}`, this.GenerateInconflictPoint(20));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		const texture = this.oddvar.Add("TexturesManager").CreateColoredTexture(currentColor, { fill: currentColor });

		this.oddvar.Add("Graphics").CreateRectangleEntityAvatar(`test avatar ${player.id}`, e, this.size, texture);
		const b = this.oddvar.Add("Physics").CreateRectangleBody(`test body ${player.id}`, e, {lineFriction: 0.1, angleFriction: 0.1}, this.size)

		const c = this.oddvar.Add("Controller").CreatePhysicControlled(`test physic controlled ${player.id}`, b, player);
		this.oddvar.Add("Graphics").CreatePhysicControlledAvatar(`test avatar ${player.id} scode`, c, currentColor)
		this.usersThings.set(player.id, { entity: e, controller: c, body: b });
		player.DeathSubscribe(p => {
			e.Die();
			this.usersThings.delete(player.id);
		})
	}
}
