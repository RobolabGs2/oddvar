import { Oddvar, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { ServerMessageTypeMap } from '../oddvar/protocol';
import { ReflectionJSON } from '../oddvar/reflection';
import { ClientPlayers } from "./players";


export class Processor {
	private oddvar: Oddvar;
	players: ClientPlayers;
	constructor(private socket: WebSocket, reflectionJSON: ReflectionJSON) {
		const world = new World();
		this.players = new ClientPlayers(socket);
		this.oddvar = new Oddvar(new Worlds(world, this.players), reflectionJSON);
		
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
				case "id":
					this.players.myId = data.data;
					break;
				default:
					console.error("unknown type", data)
			}
		});
	}
}
