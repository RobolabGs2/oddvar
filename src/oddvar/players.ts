import { KeyInput } from "./protocol";
import { Deadly, DeadlyWorld } from "./base";

export interface Player extends Deadly {
	readonly input: ReadonlyArray<KeyInput>;
	readonly id: number;
	readonly isCurrent: boolean;
	readonly sync: number;
	readonly wasSnapshot: boolean;
}

export interface Players extends DeadlyWorld<Player> {
	CreatePlayer(name: string, id: number): Player;
}
