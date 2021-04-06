import { Manager } from "../oddvar/manager";

export class Processor {
	private _manager: Manager;
	constructor(manager: Manager) {
		this._manager = this.manager = manager;
		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.03)
				dt = 0.03;
			this._manager.DrawTick(dt);
			requestAnimationFrame(Tick);
		};

		let lastTime2 = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime2) / 1000;
			lastTime2 = t;
			this._manager.Tick(dt);
		}, 15);

		requestAnimationFrame(Tick);
	}

	public set manager(manager : Manager) {
		this._manager = manager;
		manager.AddUser(0);
		manager.AddUser(1);
	}
	
}
