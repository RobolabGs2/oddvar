import { Player } from "./players";
import { GameLogic } from "./manager";


export class EmptyGameLogic implements GameLogic
{
	Tick(dt: number): void {
	}

	AddUser(id: Player): void {
	}
}
