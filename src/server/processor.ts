import { Point } from '../oddvar/geometry';
import * as WebSocket from 'ws';
import { Oddvar } from "../oddvar/oddvar"
import { World } from "../oddvar/world"

export class Processor
{
	private oddvar: Oddvar;
	private webSockets = new Map<number, WebSocket>();
	private lastID = 0;

	constructor() {
		const world = new World();
		this.oddvar = new Oddvar(world);
		this.oddvar.AddInUnderWorld(world.CreateEntity(new Point(10, 10)));

		let lastTime = 0;
		setInterval(() => {
			const t = new Date().getTime();
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this.oddvar.tick(dt);
		}, 15);

		setInterval(() => {
			const delta = JSON.stringify({ type: "snapshot", data: this.oddvar.GetDelta(true)}); // TODO: GetDelta()
			this.webSockets.forEach(ws => ws.send(delta));
		}, 100);
	}

	public AddClient(ws: WebSocket) {
		this.webSockets.set(this.lastID, ws);
		const id = this.lastID;
		++this.lastID;

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
