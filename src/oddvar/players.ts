import { KeyInput } from "./protocol";
import { Deadly, DeadlyWorld } from "./base";

export abstract class Player extends Deadly {
	abstract readonly input: ReadonlyArray<KeyInput>;
	abstract readonly id: number;
	abstract readonly isCurrent: boolean;
}

export interface Players extends DeadlyWorld<Player> {
	CreatePlayer(name: string, id: number): Player;
}
