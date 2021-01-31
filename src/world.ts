import { Deadly, DeadlyWorld } from "base"
import { Matrix, Point } from "geometry"


export class Entity extends Deadly {
	public constructor(
		public location: Point,
		public rotation: number = 0
	) {
		super()
	}

	public Transform(): Matrix {
		return Matrix.Rotation(this.rotation).
			Mult(Matrix.Translate(this.location));
	}
}

export class TailEntity extends Entity {
	public constructor(
		public readonly parent: Entity,
		location: Point,
		rotation: number = 0
	) {
		super(location, rotation)
		parent.DeathSubscribe(() => this.Die());
	}

	public Transform(): Matrix {
		return super.Transform().Mult(this.parent.Transform());
	}
}

export class World extends DeadlyWorld<Entity>
{
	public constructor() {
		super();
	}

	public CreateEntity(location: Point, rotation: number = 0): Entity {
		return this.AddDeadly(new Entity(location, rotation));
	}

	public CreateTailEntity(target: Entity, location: Point, rotation: number = 0): TailEntity {
		return this.AddDeadly(new TailEntity(target, location, rotation));
	}
}
