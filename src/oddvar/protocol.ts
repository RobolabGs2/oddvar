import { OddvarSnapshot } from "./oddvar";


export interface ServerMessageTypeMap {
	"snapshot": OddvarSnapshot;
	"id": number;
}

export interface ServerMessage<K extends keyof ServerMessageTypeMap> {
	type: K
	data: ServerMessageTypeMap[K]
}

export function CreateServerMessage<K extends keyof ServerMessageTypeMap>(type: K, data: ServerMessageTypeMap[K]): string {
	return JSON.stringify({ type, data }, undefined, 2)
}

export type KeyInput = { action: "up" | "down", key: string};

export interface ClientMessageTypeMap {
	"input": KeyInput;
}

export interface ClientMessage<K extends keyof ClientMessageTypeMap> {
	type: K
	data: ClientMessageTypeMap[K]
}

export function CreateClientMessage<K extends keyof ClientMessageTypeMap>(type: K, data: ClientMessageTypeMap[K]): string {
	return JSON.stringify({ type, data }, undefined, 2)
}
