import { Point, Size } from '../oddvar/geometry';
import * as WebSocket from 'ws';
import { Oddvar, OddvarSnapshot, Worlds } from "../oddvar/oddvar"
import { Entity, World } from "../oddvar/world"
import { ClientMessageTypeMap, CreateServerMessage, HandleMessage } from "../oddvar/protocol"
import { ReflectionJSON } from '../oddvar/reflection';
import { Graphics } from '../oddvar/graphics';
import { ServerPlayers } from './players';
import { Player } from 'oddvar/players';
import { ControlledWalker, Controller } from '../oddvar/controller';
import { GameLogic, Manager } from '../oddvar/manager';
import { ColoredTexture, TexturesManager } from '../oddvar/textures';
import { Physics } from '../oddvar/physics/physics';

class TestGamelogic implements GameLogic {
	private usersThings = new Map<number, { entity: Entity, controller: ControlledWalker }>();
	private targetPoint: Entity;
	private readonly size = new Size(20, 20);

	constructor(private oddvar: Oddvar) {
		this.targetPoint = oddvar.Add("World").CreateEntity("targetPoint", new Point(0, 0))
		oddvar.Add("Graphics").CreateRectangleEntityAvatar("targetEntityAvatar", this.targetPoint, new Size(10, 10), this.oddvar.Add("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }));
		const tail = oddvar.Add("World").CreateTailEntity("targetTail", this.targetPoint, new Point(10, 0), Math.PI / 4);
		oddvar.Add("Graphics").CreateCircleEntityAvatar("targetTailAvatar", tail, 7, this.oddvar.Add("TexturesManager").CreateColoredTexture("limestroke", ({ stroke: "lime" })))
		oddvar.Add("Controller").CreateSpinRoundController("spinTarget", this.targetPoint);
		this.RelocatePoint();
		{
			const e = oddvar.Add("World").CreateEntity("Physics test entity", new Point(100, 200));
			oddvar.Add("Physics").CreateRectangleBody("Physics test body", e, { density: 1}, new Size(10, 10)).lineVelocity.x = 10
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar", e, new Size(10, 10), this.oddvar.Add("TexturesManager").CreateColoredTexture("limestroke2", ({ stroke: "lime" })))
			const e2 = oddvar.Add("World").CreateEntity("Physics test entity2", new Point(200, 200), 1);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body2", e2, { density: 1}, new Size(10, 10))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar2", e2, new Size(10, 10), this.oddvar.Add("TexturesManager").CreateColoredTexture("limestroke3", ({ stroke: "lime" })))
		}
		{
			const border1 = oddvar.Add("World").CreateEntity("Physics test entity border1", new Point(100, 100), -Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border1", border1, { density: 1}, new Size(250, 20))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border1", border1, new Size(250, 20), this.oddvar.Add("TexturesManager").CreateColoredTexture("border1 color", ({ stroke: "black" })))

			const border2 = oddvar.Add("World").CreateEntity("Physics test entity border2", new Point(300, 100), Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border2", border2, { density: 1}, new Size(250, 20))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border2", border2, new Size(250, 20), this.oddvar.Add("TexturesManager").CreateColoredTexture("border2 color", ({ stroke: "black" })))
			
			const border3 = oddvar.Add("World").CreateEntity("Physics test entity border3", new Point(100, 300), Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border3", border3, { density: 1}, new Size(250, 20))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border3", border3, new Size(250, 20), this.oddvar.Add("TexturesManager").CreateColoredTexture("border3 color", ({ stroke: "black" })))
			
			const border4 = oddvar.Add("World").CreateEntity("Physics test entity border4", new Point(300, 300), -Math.PI / 4);
			oddvar.Add("Physics").CreateRectangleBody("Physics test body border4", border4, { density: 1}, new Size(250, 20))
			oddvar.Add("Graphics").CreateRectangleEntityAvatar("Physics test avatar border4", border4, new Size(250, 20), this.oddvar.Add("TexturesManager").CreateColoredTexture("border4 color", ({ stroke: "black" })))
		}
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
		const texture = this.oddvar.Add("TexturesManager").CreateColoredTexture(currentColor, { fill: currentColor });
		if ((Math.random()*10|0)%2)
			this.oddvar.Add("Graphics").CreateRectangleEntityAvatar(`test avatar ${player.id}`, e, this.size, texture);
		else
			this.oddvar.Add("Graphics").CreateCircleEntityAvatar(`test avatar ${player.id}`, e, this.size.height/2, texture);

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
		const physics = new Physics();
		const graphics = this.CreateEmptyGraphics();
		const controller = new Controller(true);
		this.players = new ServerPlayers();
		const oddvar = new Oddvar(new Worlds(world, this.players, physics, graphics, controller, new TexturesManager()), reflectionJSON);
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
