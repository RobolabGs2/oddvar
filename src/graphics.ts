import { Deadly, DeadlyWorld } from "./base"
import { Entity} from "./world"
import { Size } from "./geometry";

export abstract class Avatar extends Deadly
{
	public constructor(public readonly entity: Entity, protected readonly g: Graphics) {
		super();
		entity.DeathSubscribe(() => this.Die());
	}

	public Tick(dt: number) {
		this.g.context.save();
		this.Draw();
		this.g.context.restore();
	}

	protected abstract Draw(): void;
}

export class Reactangle extends Avatar
{
	public constructor(public size: Size, entity: Entity, g: Graphics) {
		super(entity, g);
	}

	protected Draw() {
		this.g.context.translate(this.entity.location.x, this.entity.location.y);
		this.g.context.rotate(this.entity.rotation);
		this.g.context.fillRect(
			this.size.width / 2, this.size.height / 2,
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

	public CreateRectangle(size: Size, entity: Entity): Reactangle {
		return this.AddDeadly(new Reactangle(size, entity, this));
	}
}
