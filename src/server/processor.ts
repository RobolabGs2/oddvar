import { Point } from '../oddvar/geometry';
import * as WebSocket from 'ws';
import { Oddvar } from "../oddvar/oddvar"
import { World } from "../oddvar/world"
import { CreateServerMessage } from "../oddvar/protocol"
import { ReflectionJSON } from 'oddvar/reflection';

export class Processor {
	private oddvar: Oddvar;
	private webSockets = new Map<number, WebSocket>();
	private lastID = 0;

	constructor(reflectionJSON: ReflectionJSON) {
		const world = new World();
		this.oddvar = new Oddvar(world, reflectionJSON);
		const e = this.oddvar.Add(world).CreateEntity("Entity1", new Point(10, 10));
		this.oddvar.Add(world).CreateTailEntity("Entity2", e, new Point(1, 2), 1);

		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.oddvar.tick(dt);
		}, 15);

		setInterval(() => {
			const delta = CreateServerMessage("snapshot", { Delta: this.oddvar.GetDelta() });
			this.webSockets.forEach(ws => ws.send(delta));
		}, 100);
	}

	public AddClient(ws: WebSocket) {
		this.webSockets.set(this.lastID, ws);
		const id = this.lastID;
		++this.lastID;
		// TODO: add new connect in special queue (кучка)
		const json = CreateServerMessage("snapshot", this.oddvar.GetSnapshot());
		console.log(json)
		ws.send(json)

		// TODO: connect to oddvar
		ws.on('message', (message: string) => {
			console.log('received: %s', message);
		});

		ws.on('close', (code, r) => {
			console.warn('close: %d %s', code, r);
			this.webSockets.delete(id);
		})
	}
}
