import { Oddvar, OddvarSnapshot, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { CreateClientMessage, HandleMessage, ServerMessageTypeMap } from '../oddvar/protocol';
import { ReflectionJSON } from '../oddvar/reflection';
import { ClientPlayers } from "./players";
import { Graphics } from "../oddvar/graphics";
import * as HTML from "../web/html";
import { Controller } from "../oddvar/controller";
import { Manager } from "../oddvar/manager";
import { EmptyGameLogic } from "../oddvar/empty_game_logic";
import { TexturesManager } from "../oddvar/textures";
import { Physics } from "../oddvar/physics/physics";
import { Keyboard } from "../oddvar/input";


export class Processor {
	private manager: Manager;
	players: ClientPlayers;
	constructor(private socket: WebSocket, reflectionJSON: ReflectionJSON) {
		const world = new World();
		const graphics = this.CreateGraphics();
		const physics = new Physics();
		this.players = new ClientPlayers(socket, new Keyboard());
		const controller = new Controller(true);
		const oddvar = new Oddvar(new Worlds(world, this.players,physics, graphics, controller, new TexturesManager()), reflectionJSON);
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
			HandleMessage<ServerMessageTypeMap>(event.data, {
				id:
					id => this.players.myId = id,
				snapshot:
					snapshot => this.manager.ApplySnapshot(snapshot)
			})
		});

		socket.addEventListener("open", () => {
			requestAnimationFrame(Tick);
		})
		socket.addEventListener("close", (ev) => {
			console.error("Connection closed", ev)
			// Reload page
			setTimeout(() => window.location = window.location, 2000)

		})
		socket.addEventListener("error", (ev) => {
			console.error("Error occured", ev)
			// Reload page
			setTimeout(() => window.location = window.location, 2000)
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
