import { Deadly, DeadlyWorld } from "./base"
import { IEntity } from "./world"
import { Matrix, Size } from "./geometry";
import { ControlledWalker, PhysicControlled } from "./controller";
import { RectangleTexture, CircleTexture, TransformContext } from "./textures";
import { RectangleBody } from "./physics/body";


export abstract class DeadlyAvatar extends Deadly {
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

	FromDelta(delta: any): void {
	}

	ToDelta(force: boolean): any {
		return undefined;
	}

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

export class RectangleBodyAvatar extends RectangleEntityAvatar {
	public constructor(name: string, public readonly body: RectangleBody, public readonly texture: RectangleTexture) {
		super(name, body.entity, body.size, texture);
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
			context.strokeRect(0, 0, 500, 500);
		}
		TransformContext(context, this.controller.entity.Transform());
		context.fillStyle = this.controller.player.isCurrent ? "black" : "red";
		context.textAlign = "center"
		context.textBaseline = "bottom"
		context.fillText(`${this.controller.score}`, 0, -10)
	}

	FromDelta(delta: any): void {
	}

	ToDelta(force: boolean): any {
		return undefined;
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
		if (this.controller.player.isCurrent) {
			context.strokeStyle = this.playerColor;
			context.lineWidth = 10;
			context.strokeRect(0, 0, 500, 500);
		}
		TransformContext(context, this.controller.body.entity.Transform());
		context.fillStyle = this.controller.player.isCurrent ? "black" : "red";
		context.textAlign = "center"
		context.textBaseline = "bottom"
		context.fillText(`${this.controller.score}`, 0, -10)
	}

	FromDelta(delta: any): void {
	}

	ToDelta(force: boolean): any {
		return undefined;
	}

	ToConstructor(): any[] {
		return [this.controller.Name, this.playerColor];
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

	public CreateRectangleEntityAvatar(name: string, entity: IEntity, size: Size, texture: RectangleTexture): RectangleEntityAvatar {
		return this.AddDeadly(new RectangleEntityAvatar(name, entity, size, texture));
	}

	public CreateCircleEntityAvatar(name: string, entity: IEntity, r: number, texture: CircleTexture): CircleEntityAvatar {
		return this.AddDeadly(new CircleEntityAvatar(name, entity, r, texture));
	}

	public CreateControlledWalkerAvatar(name: string, controller: ControlledWalker, playerColor: string): ControlledWalkerAvatar {
		return this.AddDeadly(new ControlledWalkerAvatar(name, controller, playerColor));
	}

	public CreatePhysicControlledAvatar(name: string, controller: PhysicControlled, playerColor: string): PhysicControlledAvatar {
		return this.AddDeadly(new PhysicControlledAvatar(name, controller, playerColor));
	}
}
