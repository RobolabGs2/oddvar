import { Player } from "./players";
import { Oddvar, OddvarSnapshot } from "./oddvar";


export interface GameLogic {
	Tick(dt: number): void;
}

export interface MultiplayerGame extends GameLogic {
	AddUser(player: Player): void;
}

export function HasMultiplayer(game: GameLogic): game is MultiplayerGame {
	return Reflect.has(game, "AddUser");
}

export interface MetricsSource extends GameLogic {
	CollectMetrics(): any;
}

export function HasMetrics(game: GameLogic): game is MetricsSource {
	return Reflect.has(game, "CollectMetrics");
}

export class Manager {
	private users = new Map<number, Player>();

	constructor(
		public readonly oddvar: Oddvar,
		public readonly gameLogic: GameLogic) {
	}

	public DrawTick(dt: number) {
		this.oddvar.DrawTick(dt);
	}

	public Tick(dt: number) {
		this.oddvar.Tick(dt);
		this.gameLogic.Tick(dt);
	}

	public GetSnapshot(force: boolean): OddvarSnapshot {
		let sn = this.oddvar.GetSnapshot(force);
		return sn;
	}

	public ApplySnapshot(snapshot: OddvarSnapshot): void {
		return this.oddvar.ApplySnapshot(snapshot);
	}

	public AddUser(id: number) {
		if (!HasMultiplayer(this.gameLogic))
			return;
		const user = this.oddvar.Get("Players").CreatePlayer(`origin user name ${id}#kljdsfghdfklsghdhfj`, id);
		this.users.set(id, user);
		user.DeathSubscribe(() => this.users.delete(id));
		this.gameLogic.AddUser(user);
	}

	public HasPlayers(): boolean {
		return HasMultiplayer(this.gameLogic);
	}

	public DeleteUser(id: number) {
		this.users.get(id)?.Die();
	}

	public get metrics() {
		if (HasMetrics(this.gameLogic))
			return this.gameLogic.CollectMetrics();
		return undefined;
	}
}
