import { Deadly, DeadlyWorld } from "./base";

export interface Player extends Deadly {
	readonly input: ReadonlyArray<string>;
}

export interface Players extends DeadlyWorld<Player> {
	CreatePlayer(name: string, id: number): Player;
}
