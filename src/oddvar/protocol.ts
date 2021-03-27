import { OddvarSnapshot } from "./oddvar";

export type MessageHandler<T> = {
	[K in keyof T]: (data: T[K]) => void
}

export function HandleMessage<T>(message: string, handler: MessageHandler<T>) {
	const json = JSON.parse(message);
	const h = handler[json.type as keyof T];
	if(!h){
		console.error(`Unknown message type: '${json.type}', in message '${message}'`)
		return
	}
	h(json.data)
}

export interface ServerMessageTypeMap {
	"snapshot": OddvarSnapshot;
	"id": number;
}

interface Message<M, K extends keyof M> {
	type: K,
	data: M[K]
}

export type ServerMessage<K extends keyof ServerMessageTypeMap> = Message<ServerMessageTypeMap, K>

export function CreateServerMessage<K extends keyof ServerMessageTypeMap>(type: K, data: ServerMessageTypeMap[K]): string {
	return JSON.stringify({ type, data }, undefined, 2)
}

export enum KeyAction { UP, DOWN, LEFT, RIGHT }

export type KeyInput = { action: "up" | "down", key: KeyAction, sync: number};

export interface ClientMessageTypeMap {
	"input": KeyInput;
	"sync": number;
}

export type ClientMessage<K extends keyof ClientMessageTypeMap> = Message<ClientMessageTypeMap, K>

export function CreateClientMessage<K extends keyof ClientMessageTypeMap>(type: K, data: ClientMessageTypeMap[K]): string {
	return JSON.stringify({ type, data }, undefined, 2)
}
