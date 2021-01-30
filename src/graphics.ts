import { Deadly, DeadlyWorld } from "./base"
import { Entity} from "./world"
import { Matrix, Size } from "./geometry";

function TransformContext(c: CanvasRenderingContext2D, m: Matrix) {
	c.transform(
		m.Get(0, 0), m.Get(0, 1),
		m.Get(1, 0), m.Get(1, 1),
		m.Get(2, 0), m.Get(2, 1));
}

export abstract class Avatar extends Deadly
{
	public constructor(protected readonly g: Graphics) {
		super();
	}

	public Tick(dt: number) {
		this.g.context.save();
		this.Draw();
		this.g.context.restore();
	}

	protected abstract Draw(): void;
}

export abstract class EntityAvatar extends Avatar
{
	public constructor(public readonly entity: Entity, protected readonly g: Graphics) {
		super(g);
		entity.DeathSubscribe(() => this.Die());
	}
}

export class Reactangle extends EntityAvatar
{
	public constructor(entity: Entity, public size: Size, g: Graphics) {
		super(entity, g);
	}

	protected Draw() {
		const m = this.entity.Transform();
		TransformContext(this.g.context, m);
		this.g.context.fillRect(
			-this.size.width / 2, -this.size.height / 2,
			this.size.width, this.size.height);
	}
}

export class Graphics extends DeadlyWorld<Avatar>
{
	private canvas = document.createElement("canvas");
	public readonly context: CanvasRenderingContext2D;

	constructor(parent: HTMLElement = document.body) {
		super();
		this.canvas.width = 500;
		this.canvas.height = 500;
		this.context = this.canvas.getContext("2d")!
		parent.appendChild(this.canvas);
	}

	public Tick(dt: number) {
		this.context.clearRect(0, 0, 500, 500);
		this.mortals.forEach(e => {
			e.Tick(dt);
		})
	}

	public CreateRectangle(entity: Entity, size: Size): Reactangle {
		return this.AddDeadly(new Reactangle(entity, size, this));
	}
}
