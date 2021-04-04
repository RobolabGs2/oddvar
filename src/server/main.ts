import * as express from 'express';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as WebSocket from 'ws';
import { Processor } from './processor';
import * as fs from 'fs';
import {} from './polyfills';

const reflectionJSONFile = fs.readFileSync("resources/reflection.json", { encoding: "utf-8" });
const app = express();
const processor = new Processor(JSON.parse(reflectionJSONFile));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function GetSlowSocket(ws: WebSocket, delayMin: number, delayMax: number): WebSocket {
	if (delayMax == 0)
		return ws;
	const dist = delayMax - delayMin;
	return new Proxy<WebSocket>(ws, {
		get: (target, p, receiver) => {
			const property = Reflect.get(target, p, receiver)
			// if (!(property instanceof Function) ||typeof p != "string")
			// 	console.log(p, typeof p, property);
			if (!(property instanceof Function) || typeof p != "string" || (p != "send" && p != "on")) {
				return property;
			}
			const f = property as Function;
			if (p == "on") {
				return (action: string, callback: Function) => {
					f.apply(target, [action, (...args: any) => {
						setTimeout(() => {
							callback.apply(target, args)
						}, Math.random() * dist + delayMin);
					}])
				};
			}
			return (...args: any) => {
				setTimeout(() => {
					f.apply(target, args)
				}, Math.random() * dist + delayMin);
			};
		}
	});
}

wss.on('connection', (ws: WebSocket) => {
	processor.AddClient(GetSlowSocket(ws, 0, 0));
});

server.listen(process.env.PORT || 8999, () => {
	console.log(`Server started on port ${(server.address() as AddressInfo).port}`);
});