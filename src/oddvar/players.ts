import { Deadly, DeadlyWorld } from "./base";

export abstract class Player extends Deadly {
	abstract readonly input: ReadonlyArray<string>;
	abstract readonly id: number;
}

export interface Players extends DeadlyWorld<Player> {
	CreatePlayer(name: string, id: number): Player;
}
