import { Point } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { World } from "../oddvar/world"


export class Processor
{
	private oddvar: Oddvar;
	constructor(private socket: WebSocket) {
		const world = new World();
		this.oddvar = new Oddvar(world);
		this.oddvar.AddInUnderWorld(world.CreateEntity(new Point(0, 0)));

		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.oddvar.tick(dt);
		}, 15);

		socket.addEventListener("message", (event) => {
			// TODO: { type: string, data: any } to common
			const data: { type: string, data: any } = JSON.parse(event.data);
			if (data.type == "snapshot") {
				this.oddvar.ApplyDelta(data.data);
			}
		});
	}
}
