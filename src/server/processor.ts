import { Point, Size } from '../oddvar/geometry';
import * as WebSocket from 'ws';
import { Oddvar, OddvarSnapshot, Worlds } from "../oddvar/oddvar"
import { Entity, World } from "../oddvar/world"
import { ClientMessageTypeMap, CreateServerMessage } from "../oddvar/protocol"
import { ReflectionJSON } from '../oddvar/reflection';
import { Graphics, RectangleTexture } from '../oddvar/graphics';
import { ServerPlayers } from './players';
import { Player, Players } from 'oddvar/players';
import { stringify } from 'node:querystring';
import { ControlledWalker, Controller } from '../oddvar/controller';
import { GameLogic, Manager } from '../oddvar/manager';
import { Deadly } from '../oddvar/base';

class TestGamelogic implements GameLogic {
	private usersThings = new Map<number, { entity: Entity, controller: ControlledWalker }>();
	private targetPoint: Entity;
	private readonly size = new Size(20, 20);

	constructor(private oddvar: Oddvar) {
		this.targetPoint = oddvar.Add("World").CreateEntity("targetPoint", new Point(0, 0))
		oddvar.Add("Graphics").CreateEntityAvatar("targetEntityAvatar", this.targetPoint, new Size(10, 10), new RectangleTexture({ fill: "green" }));
		this.RelocatePoint();
	}

	private RelocatePoint() {
		this.targetPoint.location = new Point(Math.random() * 500, Math.random() * 500);
	}

	Tick(dt: number): void {
		this.usersThings.forEach(e => {
			const delta = this.targetPoint.location.Sub(e.entity.location);
			if (Math.abs(delta.x) < (this.size.width + 10) / 2 && Math.abs(delta.y) < (this.size.height + 10) / 2) {
				this.RelocatePoint();
				e.controller.score += 1;
			}
		})
	}

	AddUser(player: Player): void {
		const e = this.oddvar.Add("World").CreateEntity(`test entity ${player.id}`, new Point(Math.random() * 500, Math.random() * 500));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		this.oddvar.Add("Graphics").CreateEntityAvatar(`test avatar ${player.id}`, e, this.size, new RectangleTexture({ fill: currentColor }));
		const c = this.oddvar.Add("Controller").CreateControlledWalker(`test controlled wolker ${player.id}`, e, player);
		this.oddvar.Add("Graphics").CreateControlledWalkerAvatar(`test avatar ${player.id} scode`, c, currentColor)
		this.usersThings.set(player.id, { entity: e, controller: c });
		player.DeathSubscribe(p => {
			e.Die();
			this.usersThings.delete(player.id);
		})
	}
}

export class Processor {
	private manager: Manager;
	private players: ServerPlayers;
	private webSockets = new Map<number, WebSocket>();
	private newConnectionSockets = new Array<WebSocket>();
	private lastID = 0;

	constructor(reflectionJSON: ReflectionJSON) {
		const world = new World();
		const graphics = this.CreateEmptyGraphics();
		const controller = new Controller(true);
		this.players = new ServerPlayers();
		const oddvar = new Oddvar(new Worlds(world, this.players, graphics, controller), reflectionJSON);
		this.manager = new Manager(oddvar, new TestGamelogic(oddvar));


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

	private CreateEmptyGraphics() {
		return new Graphics(new Proxy<CanvasRenderingContext2D>({} as CanvasRenderingContext2D, {
			get: () => { return () => { } }
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

		this.manager.AddUser(id);
		ws.on('message', (event) => {
			const data = JSON.parse(event.toString());
			switch (data.type as keyof ClientMessageTypeMap) {
				case "input":
					this.players.AddUserInput(id, data.data);
					break;
				case "sync":
					this.players.SetSync(id, data.data)
					break;
				default:
					console.error("unknown type", data)
			}
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
