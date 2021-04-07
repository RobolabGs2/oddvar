import { Deadly, DeadlyWorld, StatelessDeadly } from "./base"
import { IEntity } from "./world"
import { Matrix, Point, Size } from "./geometry";
import { ControlledWalker, PhysicControlled } from "./controller";
import { RectangleTexture, CircleTexture, TransformContext, VectorTexture, ColoredTexture } from "./textures";
import { Body, RectangleBody } from "./physics/body";
import { Essence } from "./physics/essence";
import { RaySensor } from "./physics/sensor";


export abstract class DeadlyAvatar extends StatelessDeadly {
	public constructor(name: string, deadly: Deadly) {
		super(name);
		deadly.DeathSubscribe(() => this.Die())
	}
	public abstract Tick(dt: number, context: CanvasRenderingContext2D): void;
}

abstract class EntityAvatar extends DeadlyAvatar {
	public constructor(name: string, public readonly entity: IEntity) {
		super(name, entity);
	}

	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.entity.Transform());
		this.drawEntity(dt, context);

	}

	protected abstract drawEntity(dt: number, context: CanvasRenderingContext2D): void;

	abstract ToConstructor(): any[];
}

abstract class BodyAvatar extends DeadlyAvatar {
	public constructor(name: string, public readonly body: Body) {
		super(name, body);
	}

	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.body.entity.Transform());
		this.drawEssense(dt, context);
	}

	protected abstract drawEssense(dt: number, context: CanvasRenderingContext2D): void;

	abstract ToConstructor(): any[];
}


export class RectangleEntityAvatar extends EntityAvatar {
	protected drawEntity(dt: number, context: CanvasRenderingContext2D): void {
		this.texture.DrawRectangle(context, this.size);
	}
	public constructor(name: string, public readonly entity: IEntity, public readonly size: Size, public readonly texture: RectangleTexture) {
		super(name, entity);
	}

	ToConstructor(): any[] {
		return [this.entity.Name, this.size, this.texture.Name];
	}
}

export class RectangleBodyAvatar extends BodyAvatar {
	protected drawEssense(dt: number, context: CanvasRenderingContext2D): void {
		this.texture.DrawRectangle(context, this.body.size);
	}
	public constructor(name: string, public readonly body: RectangleBody, public readonly texture: RectangleTexture) {
		super(name, body);
	}

	ToConstructor(): any[] {
		return [this.body.Name, this.texture.Name];
	}
}

export class CircleEntityAvatar extends EntityAvatar {
	protected drawEntity(dt: number, context: CanvasRenderingContext2D): void {
		this.texture.DrawCircle(context, this.r);
	}

	public constructor(name: string, public readonly entity: IEntity, public readonly r: number, public readonly texture: CircleTexture) {
		super(name, entity);
	}

	ToConstructor(): any[] {
		return [this.entity.Name, this.r, this.texture.Name];
	}
}


export class ControlledWalkerAvatar extends DeadlyAvatar {
	public constructor(name: string, public readonly controller: ControlledWalker, public readonly playerColor: string) {
		super(name, controller);
	}

	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		if (this.controller.player.isCurrent) {
			context.strokeStyle = this.playerColor;
			context.lineWidth = 10;
		}
		TransformContext(context, this.controller.entity.Transform());
		context.fillStyle = this.controller.player.isCurrent ? "black" : "red";
		context.textAlign = "center"
		context.textBaseline = "bottom"
		context.fillText(`${this.controller.score}`, 0, -10)
	}

	ToConstructor(): any[] {
		return [this.controller.Name, this.playerColor];
	}
}

export class PhysicControlledAvatar extends DeadlyAvatar {
	public constructor(name: string, public readonly controller: PhysicControlled, public readonly playerColor: string) {
		super(name, controller);
	}

	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		TransformContext(context, this.controller.body.entity.Transform());
		context.fillStyle = this.playerColor;
		context.textAlign = "center"
		context.textBaseline = "bottom"
		context.font = "italic 14px sans-serif";
		context.fillText(`${this.controller.score}`, 0, -10)
	}

	ToConstructor(): any[] {
		return [this.controller.Name, this.playerColor];
	}
}

export class RaySensorAvatar extends DeadlyAvatar {
	constructor(name: string, readonly ray: RaySensor, readonly texture: VectorTexture) {
		super(name, ray)
	}
	public Tick(dt: number, context: CanvasRenderingContext2D): void {
		if (this.ray.observable) {
			TransformContext(context, this.ray.entity.Transform());
			this.texture.DrawVector(context, new Point(this.ray.distance, 0));
		}
	}
	ToConstructor(): any[] {
		throw new Error("Method not implemented.");
	}

}

function drawAvatar(context: CanvasRenderingContext2D, dt: number, avatar: DeadlyAvatar) {
	context.save();
	avatar.Tick(dt, context);
	context.restore();
}

function drawAll(avatars: Set<DeadlyAvatar>, context: CanvasRenderingContext2D, dt: number) {
	avatars.forEach(drawAvatar.bind(undefined, context, dt));
}

export class Graphics extends DeadlyWorld<DeadlyAvatar>
{
	private _backgound?: ImageData;
	private get backgound(): ImageData {
		if (this._backgound === undefined)
			this._backgound = this.hiddenContext.getImageData(0, 0, this.hiddenContext.canvas.width, this.hiddenContext.canvas.height);
		return this._backgound;
	}

	constructor(public readonly context: CanvasRenderingContext2D, public readonly hiddenContext: CanvasRenderingContext2D) {
		super();
		this.redrawBackground();
	}
	dynamic = new Set<DeadlyAvatar>();
	static = new Set<DeadlyAvatar>();
	public Tick(dt: number) {
		if (this.backgound)
			this.context.putImageData(this.backgound, 0, 0)
		drawAll(this.dynamic, this.context, dt);
	}

	protected redrawBackground() {
		this.hiddenContext.clearRect(0, 0, this.hiddenContext.canvas.width, this.hiddenContext.canvas.height);
		drawAll(this.static, this.hiddenContext, 0.01);
	}

	protected AddAvatar<T extends DeadlyAvatar>(avatar: T, dynamic = true): T {
		if (dynamic) {
			this.dynamic.add(avatar);
			avatar.DeathSubscribe(_=>this.dynamic.delete(avatar));
		} else {
			this.static.add(avatar);
			drawAvatar(this.hiddenContext, 0.01, avatar);
			avatar.DeathSubscribe(_=>{
				this.static.delete(avatar);
				this.redrawBackground();
			});
		}
		return this.AddDeadly(avatar);
	}

	protected AddBodyAvatar<T extends BodyAvatar>(avatar: T, dynamic = true): T {
		return this.AddAvatar(avatar, !avatar.body.material.static);
	}

	public CreateRectangleEntityAvatar(name: string, entity: IEntity, size: Size, texture: RectangleTexture): RectangleEntityAvatar {
		return this.AddAvatar(new RectangleEntityAvatar(name, entity, size, texture));
	}

	public CreateRectangleBodyAvatar(name: string, body: RectangleBody, texture: RectangleTexture): RectangleBodyAvatar {
		return this.AddBodyAvatar(new RectangleBodyAvatar(name, body, texture));
	}

	public CreateRaySensorAvatar(name: string, ray: RaySensor, texture: VectorTexture): RaySensorAvatar {
		return this.AddAvatar(new RaySensorAvatar(name, ray, texture));
	}

	public CreateCircleEntityAvatar(name: string, entity: IEntity, r: number, texture: CircleTexture): CircleEntityAvatar {
		return this.AddAvatar(new CircleEntityAvatar(name, entity, r, texture));
	}

	public CreateControlledWalkerAvatar(name: string, controller: ControlledWalker, playerColor: string): ControlledWalkerAvatar {
		return this.AddAvatar(new ControlledWalkerAvatar(name, controller, playerColor));
	}

	public CreatePhysicControlledAvatar(name: string, controller: PhysicControlled, playerColor: string): PhysicControlledAvatar {
		return this.AddAvatar(new PhysicControlledAvatar(name, controller, playerColor));
	}
}
