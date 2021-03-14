import { Oddvar, OddvarSnapshot, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { CreateClientMessage, ServerMessageTypeMap } from '../oddvar/protocol';
import { ReflectionJSON } from '../oddvar/reflection';
import { ClientPlayers } from "./players";
import { Graphics } from "../oddvar/graphics";
import * as HTML from "./html";
import { Controller } from "../oddvar/controller";
import { Manager } from "../oddvar/manager";
import { EmptyGameLogic } from "../oddvar/empty_game_logic";


export class Processor {
	private manager: Manager;
	players: ClientPlayers;
	constructor(private socket: WebSocket, reflectionJSON: ReflectionJSON) {
		const world = new World();
		const graphics = this.CreateGraphics();
		this.players = new ClientPlayers(socket);
		const controller = new Controller(true);
		const oddvar = new Oddvar(new Worlds(world, this.players, graphics, controller), reflectionJSON);
		this.manager = new Manager(oddvar, new EmptyGameLogic());

		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.03)
				dt = 0.03;
			this.manager.Tick(dt);
			socket.send(CreateClientMessage("sync", Date.now()));
			requestAnimationFrame(Tick);
		};

		socket.addEventListener("message", (event) => {
			const data = JSON.parse(event.data);
			switch (data.type as keyof ServerMessageTypeMap) {
				case "snapshot":
					this.manager.ApplySnapshot(data.data);
					break;
				case "id":
					this.players.myId = data.data;
					break;
				default:
					console.error("unknown type", data)
			}
		});

		socket.addEventListener("open", () => {
			requestAnimationFrame(Tick);
		})
		socket.addEventListener("close", (ev) => {
			console.error("Connection closed", ev)
			// Reload page
			setTimeout(()=>window.location = window.location, 2000)
			
		})
		socket.addEventListener("error", (ev) => {
			console.error("Error occured", ev)
			// Reload page
			setTimeout(()=>window.location = window.location, 2000)
		})
	}

	private CreateGraphics() {
		return new Graphics(HTML.CreateElement("canvas", c => {
			c.width = 500;
			c.height = 500;
			document.body.append(c);
		}).getContext("2d")!);
	}
}
