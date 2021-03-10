import * as express from 'express';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as WebSocket from 'ws';
import { Processor } from './processor';
import * as fs from 'fs';

const reflectionJSONFile = fs.readFileSync("resources/reflection.json", {encoding: "utf-8"});
const app = express();
const processor = new Processor(JSON.parse(reflectionJSONFile));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
	processor.AddClient(ws);
});

server.listen(process.env.PORT || 8999, () => {
	console.log(`Server started on port ${(server.address() as AddressInfo) .port}`);
});