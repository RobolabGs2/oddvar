import { Oddvar } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { ServerMessageTypeMap } from '../oddvar/protocol';
import { ReflectionJSON } from '../oddvar/reflection';


export class Processor {
	private oddvar: Oddvar;
	constructor(private socket: WebSocket, reflectionJSON: ReflectionJSON) {
		const world = new World();
		this.oddvar = new Oddvar(world, reflectionJSON);
		
		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.oddvar.tick(dt);
		}, 15);

		socket.addEventListener("message", (event) => {
			const data = JSON.parse(event.data);
			switch (data.type as keyof ServerMessageTypeMap) {
				case "snapshot":
					this.oddvar.ApplySnapshot(data.data);
					break;
				default:
					console.error("unknown type", data)
			}
		});
	}
}
