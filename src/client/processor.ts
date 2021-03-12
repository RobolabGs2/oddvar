import { Oddvar, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { ServerMessageTypeMap } from '../oddvar/protocol';
import { ReflectionJSON } from '../oddvar/reflection';
import { ClientPlayers } from "./players";
import { Graphics } from "../oddvar/graphics";
import * as HTML from "./html";
import { Controller } from "../oddvar/controller";


export class Processor {
	private oddvar: Oddvar;
	players: ClientPlayers;
	constructor(private socket: WebSocket, reflectionJSON: ReflectionJSON) {
		const world = new World();
		const graphics = this.CreateGraphics();
		this.players = new ClientPlayers(socket);
		const controller = new Controller(true);
		this.oddvar = new Oddvar(new Worlds(world, this.players, graphics, controller), reflectionJSON);
		
		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.03)
				dt = 0.03;
			this.oddvar.tick(dt);
			requestAnimationFrame(Tick);
		};
		requestAnimationFrame(Tick);

		socket.addEventListener("message", (event) => {
			const data = JSON.parse(event.data);
			switch (data.type as keyof ServerMessageTypeMap) {
				case "snapshot":
					// console.log(data.data)
					this.oddvar.ApplySnapshot(data.data);
					break;
				case "id":
					this.players.myId = data.data;
					break;
				default:
					console.error("unknown type", data)
			}
		});
	}

	private CreateGraphics() {
		return new Graphics(HTML.CreateElement("canvas", c => {
			c.width = 500;
			c.height = 500;
			document.body.append(c);
		}).getContext("2d")!);
	}
}
