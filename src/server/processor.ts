import { Point, Size } from '../oddvar/geometry';
import * as WebSocket from 'ws';
import { Oddvar, OddvarSnapshot, Worlds } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { CreateServerMessage } from "../oddvar/protocol"
import { ReflectionJSON } from '../oddvar/reflection';
import { Graphics, RectangleTexture } from '../oddvar/graphics';
import { ServerPlayers } from './players';
import { Player, Players } from 'oddvar/players';
import { stringify } from 'node:querystring';
import { Controller } from '../oddvar/controller';

export class Processor {
	private oddvar: Oddvar;
	private players: ServerPlayers;
	private webSockets = new Map<number, WebSocket>();
	private newConnectionSockets = new Array<WebSocket>();
	private lastID = 0;

	constructor(reflectionJSON: ReflectionJSON) {
		const world = new World();
		const graphics = this.CreateEmptyGraphics();
		const controller = new Controller();
		this.players = new ServerPlayers();
		this.oddvar = new Oddvar(new Worlds(world, this.players, graphics, controller), reflectionJSON);

		const e = this.oddvar.Add("World").CreateEntity("Entity1", new Point(10, 10));
		this.oddvar.Add("World").CreateTailEntity("Entity2", e, new Point(1, 2), 1);
		this.oddvar.Add("Graphics").CreateEntityAvatar("Avatar1", e, new Size(50, 50), new RectangleTexture({ fill: "black" }))
		this.oddvar.Add("Controller").CreateWalkController("Controller1", e)

		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.oddvar.tick(dt);
		}, 15);

		setInterval(() => {
			const delta = CreateServerMessage("snapshot", this.oddvar.GetSnapshot(false));
			this.webSockets.forEach(ws => ws.send(delta));

			if (this.newConnectionSockets.length > 0) {
				const json = CreateServerMessage("snapshot", this.oddvar.GetSnapshot(true));
				this.newConnectionSockets.forEach(ws => {
					const id = this.AddSocket(ws, json);
					console.log("Add client %d", id);
				});
				this.newConnectionSockets.length = 0;
			}
		}, 100);
	}

	private CreateEmptyGraphics() {
		return new Graphics(new Proxy<CanvasRenderingContext2D>( { } as CanvasRenderingContext2D, {
			get: (target, propertyName, recevier) => {
				return (...params: any) => {
				}
			}
		}));
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

		this.oddvar.Add("Players").CreatePlayer(`origin user name ${id}#kljdsfghdfklsghdhfj`, id);
		ws.on('message', (message: string) => {
			this.players.AddUserInput(id, message);
		});

		ws.on('close', (code, r) => {
			console.warn('close: %d %s', code, r);
			this.webSockets.delete(id);
			this.players.DeletePlayer(id);
		})
		return id;
	}

	public AddClient(ws: WebSocket) {
		this.newConnectionSockets.push(ws);
	}
}
