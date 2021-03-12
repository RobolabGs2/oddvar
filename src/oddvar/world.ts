import { Deadly, DeadlyWorld } from "./base"
import { Matrix, Point } from "./geometry"

export interface IEntity extends Deadly {
	Transform(): Matrix;
	InverseTransform(): Matrix;
}

class Tranformation {
	public modified: boolean = false;
	private _location: Point;
	private _rotation: number;

	constructor(location: Point, rotation: number) {
		this._location = location;
		this._rotation = rotation;
	}

	public get location(): Point {
		return this._location;
	}

	public set location(value: Point) {
		this._location = value;
		this.modified = true;
	}

	public get rotation(): number {
		return this._rotation;
	}

	public set rotation(value: number) {
		this._rotation = value;
		this.modified = true;
	}

	ToDelta(force: boolean): any {
		if (!this.modified && !force)
			return null;
		this.modified = false;
		return {
			location: this.location,
			rotation: this.rotation
		};
	}

	FromDelta(delta: any) {
		this.location = delta.location;
		this.rotation = delta.rotation;
	}

	public ToMatrix(): Matrix {
		return Matrix.Rotation(this.rotation).
			Mult(Matrix.Translate(this.location));
	}

	public Inverse(): Matrix {
		return Matrix.Translate(this.location.Mult(-1)).
			Mult(Matrix.Rotation(-this.rotation));
	}
}

export class Entity extends Deadly implements IEntity {
	private readonly shift: Tranformation;

	public constructor(
		name: string,
		location: Point,
		rotation: number = 0
	) {
		super(name);
		this.shift = new Tranformation(location, rotation);
	}

	public get location(): Point {
		return this.shift.location;
	}

	public set location(value: Point) {
		this.shift.location = value;
	}

	public get rotation(): number {
		return this.shift.rotation;
	}

	public set rotation(value: number) {
		this.shift.rotation = value;
	}

	ToConstructor(): any[] {
		return [
			this.shift.location,
			this.shift.rotation,
		];
	}

	ToDelta(force: boolean): any {
		return this.shift.ToDelta(force);
	}

	FromDelta(delta: any) {
		this.shift.FromDelta(delta);
	}

	public Transform(): Matrix {
		return this.shift.ToMatrix();
	}

	public InverseTransform(): Matrix {
		return this.shift.Inverse();
	}

}

export class TailEntity extends Deadly implements IEntity {
	private readonly shift: Tranformation;

	public constructor(
		name: string,
		public readonly parent: IEntity,
		location: Point,
		rotation: number = 0
	) {
		super(name);
		parent.DeathSubscribe(() => this.Die());
		this.shift = new Tranformation(location, rotation);
	}

	public get location(): Point {
		return this.shift.location;
	}

	public set location(value: Point) {
		this.shift.location = value;
	}

	public get rotation(): number {
		return this.shift.rotation;
	}

	public set rotation(value: number) {
		this.shift.rotation = value;
	}

	ToConstructor(): any[] {
		return [
			this.parent.Name,
			this.shift.location,
			this.shift.rotation,
		];
	}

	FromDelta(delta: any) {
		this.shift.FromDelta(delta);
	}

	ToDelta(force: boolean): any {
		return this.shift.ToDelta(force)
	}

	public Transform(): Matrix {
		return this.shift.ToMatrix().Mult(this.parent.Transform());
	}

	public InverseTransform(): Matrix {
		return this.parent.InverseTransform().Mult(this.shift.Inverse());
	}
}

export class World extends DeadlyWorld<IEntity>
{
	Tick(dt: number) {
		throw new Error("Method not implemented.");
	}
	public constructor() {
		super();
	}

	public CreateEntity(name: string, location: Point, rotation: number = 0): Entity {
		return this.AddDeadly(new Entity(name, location, rotation));
	}

	public CreateTailEntity(name: string, target: Entity, location: Point, rotation: number = 0): TailEntity {
		return this.AddDeadly(new TailEntity(name, target, location, rotation));
	}
}
