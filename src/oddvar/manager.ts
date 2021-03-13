import { Player } from "./players";
import { Oddvar, OddvarSnapshot } from "./oddvar";


export interface GameLogic 
{
	Tick(dt: number): void;
	AddUser(player: Player): void;
}

export class Manager
{
	private users = new Map<number, Player>();

	constructor(
		public readonly oddvar: Oddvar,
		public readonly gameLogic: GameLogic) {
	}

	public Tick(dt: number) {
		this.gameLogic.Tick(dt);
		this.oddvar.Tick(dt);
	}

	public GetSnapshot(force: boolean): OddvarSnapshot {
		let sn = this.oddvar.GetSnapshot(force);
		return sn;
	}

	public ApplySnapshot(snapshot: OddvarSnapshot): void {
		return this.oddvar.ApplySnapshot(snapshot);
	}

	public AddUser(id: number) {
		const user = this.oddvar.Add("Players").CreatePlayer(`origin user name ${id}#kljdsfghdfklsghdhfj`, id);
		this.users.set(id, user);
		user.DeathSubscribe(() => this.users.delete(id));
		this.gameLogic.AddUser(user);
	}

	public DeleteUser(id: number) {
		this.users.get(id)?.Die();
	}
}