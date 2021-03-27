import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';
import { KeyInput } from '../oddvar/protocol';
import { Keyboard } from '../oddvar/input';

export class LocalPlayer extends Deadly implements Player {
	public input = new Array<KeyInput>();
	private _sync = -1;
	private _wasSnapshot = false;

	public get sync(): number {
		return this._sync;
	}

	public get wasSnapshot(): boolean {
		return this._wasSnapshot;
	}

	constructor(name: string, public readonly id: number) {
		super(name);
	}

	public get isCurrent(): boolean {
		return true
	}


	public Tick(dt: number) {
		this._wasSnapshot = false;
	}

	ToConstructor(): any[] {
		return [
			this.id
		];
	}

	ToDelta(force: boolean): any {
		if (!force)
			return null;
		return 1;
	}

	FromDelta(delta: any) {
		this._sync = delta;
		this._wasSnapshot = this.sync > 0;
	}
}

export class LocalPlayers extends DeadlyWorld<LocalPlayer> implements Players {
	private players: LocalPlayer[] = [];

	constructor(keyInputs: Keyboard[]) {
		super();
		keyInputs.forEach((keyInput, i) => keyInput.addEventListener("pressKey", (input) => this.SetInput(i, input)));
	}

	private SetInput(player: number, input: KeyInput) {
		this.players[player]?.input.push(input);
	}

	private AddPlayer(player: LocalPlayer): LocalPlayer {
		this.players[player.id] = player;
		player.DeathSubscribe(() => delete (this.players[player.id]));
		return player;
	}

	CreatePlayer(name: string, id: number): Player {
		return this.AddPlayer(this.AddDeadly(new LocalPlayer(name, id)));
	}

	Tick(dt: number): void {
		this.players.forEach((player) => {
			player.input.length = 0;
			player.Tick(dt);
		})
	}
}