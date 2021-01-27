import { Deadly, DeadlyWorld } from "./base"
import { Point } from "./geometry"


export class Entity extends Deadly {
	public constructor(
		public location: Point,
		public rotation: number = 0
	) {
		super()
	}
}

export class TailEntity extends Entity {
	public constructor(
		public readonly target: Entity,
		location: Point,
		rotation: number = 0
	) {
		super(location, rotation)
		target.DeathSubscribe(() => this.Die());
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
