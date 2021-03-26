import { Manager } from "../oddvar/manager";

export class Processor {
	constructor(private readonly manager: Manager) {
		manager.AddUser(0);
		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.03)
				dt = 0.03;
			this.manager.Tick(dt);
			requestAnimationFrame(Tick);
		};
		requestAnimationFrame(Tick);
	}
}
