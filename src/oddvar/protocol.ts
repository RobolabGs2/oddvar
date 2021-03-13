import { OddvarSnapshot } from "./oddvar";


export interface ServerMessageTypeMap {
	"snapshot": OddvarSnapshot;
	"id": number;
}

export interface Message<K extends keyof ServerMessageTypeMap> {
	type: K
	data: ServerMessageTypeMap[K]
}

export function CreateServerMessage<K extends keyof ServerMessageTypeMap>(type: K, data: ServerMessageTypeMap[K]): string {
	return JSON.stringify({ type, data }, undefined, 2)
}