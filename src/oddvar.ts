import { World } from "./world"
import { Point, Size } from "./geometry";
import { Graphics } from "./graphics";
import { Controller } from "./controller";
import { Physics } from "./physics";

export class Oddvar
{
	private world = new World();
	private graphics = new Graphics();
	private controller = new Controller();
	private physics = new Physics();

	public constructor() {
		this.Init();
		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.3)
				dt = 0.3;

			this.physics.Tick(dt);
			this.controller.Tick(dt);
			this.graphics.Tick(dt);
			requestAnimationFrame(Tick);
		};
		requestAnimationFrame(Tick);
	}

	private Init() {
		let entity = this.world.CreateEntity(new Point(50, 20), 0.0); {
			this.physics.CreateRectangleBody(entity, new Size(10, 10));
			this.graphics.CreateRectangle(entity, new Size(10, 10));
			this.controller.CreateWalkController(entity);
			let tail = this.world.CreateTailEntity(entity, new Point(20, 0)); {
				this.physics.CreateRectangleBody(tail, new Size(5, 5));
				this.graphics.CreateRectangle(tail, new Size(5, 5));
				this.controller.CreateWalkController(tail);
			}
		}
	}
}
