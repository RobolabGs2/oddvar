import * as WebSocket from 'ws';
import { Oddvar, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { ClientMessageTypeMap, CreateServerMessage, HandleMessage } from "../oddvar/protocol"
import { ReflectionJSON } from '../oddvar/reflection';
import { Graphics } from '../oddvar/graphics';
import { ServerPlayers } from './players';
import { Controller } from '../oddvar/controller';
import { Manager } from '../oddvar/manager';
import { ImageSource, TexturesManager } from '../oddvar/textures';
import { Physics } from '../oddvar/physics/physics';
import { CollectingSquaresGame } from '../games/collecting_squares';


function DeepProxy<T extends object>(): T {
	const proxy: T =  new Proxy<T>(function () { } as T, {
		get: (a1, a2, a3) => {
			if (typeof a2 === "string" && !["inspect", "prototype", "consturctor"].some(x => x === a2))
				return proxy;
			return Reflect.get(a1, a2);
		},
		apply: (a1, a2, a3) => {
			return proxy;
		}
	});
	return proxy;
}

export class Processor {
	private manager: Manager;
	private players: ServerPlayers;
	private webSockets = new Map<number, WebSocket>();
	private newConnectionSockets = new Array<WebSocket>();
	private lastID = 0;

	constructor(reflectionJSON: ReflectionJSON) {
		const canvasContext = DeepProxy<CanvasRenderingContext2D>();
		const world = new World();
		const physics = new Physics();
		const graphics = new Graphics(canvasContext);
		const controller = new Controller(false);
		this.players = new ServerPlayers();
		const oddvar = new Oddvar(new Worlds(world, this.players, physics, graphics, controller, new TexturesManager(DeepProxy<ImageSource>(), canvasContext)), reflectionJSON);
		this.manager = new Manager(oddvar, new CollectingSquaresGame(oddvar));


		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.manager.Tick(dt);
		}, 15);

		setInterval(() => {
			const delta = CreateServerMessage("snapshot", this.manager.GetSnapshot(false));
			this.webSockets.forEach(ws => ws.send(delta));

			if (this.newConnectionSockets.length > 0) {
				const json = CreateServerMessage("snapshot", this.manager.GetSnapshot(true));
				this.newConnectionSockets.forEach(ws => {
					const id = this.AddSocket(ws, json);
					console.log("Add client %d", id);
				});
				this.newConnectionSockets.length = 0;
			}
		}, 50);
	}

	private PushSocket(ws: WebSocket): number {
		this.webSockets.set(this.lastID, ws);
		const id = this.lastID;
		++this.lastID;
		return this.lastID - 1;
	}

	private AddSocket(ws: WebSocket, json: string): number {
		const id = this.PushSocket(ws);
		ws.send(CreateServerMessage("id", id));
		ws.send(json)

		this.manager.AddUser(id);
		ws.on('message', (event) => {
			HandleMessage<ClientMessageTypeMap>(event.toString(), {
				input:
					input => this.players.AddUserInput(id, input),
				sync:
					sync => this.players.SetSync(id, sync)
			});
		});

		ws.on('close', (code, r) => {
			console.warn('close: %d %s', code, r);
			this.webSockets.delete(id);
			this.manager.DeleteUser(id);
		})
		return id;
	}

	public AddClient(ws: WebSocket) {
		this.newConnectionSockets.push(ws);
	}
}
