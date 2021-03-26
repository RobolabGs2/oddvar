
import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';
import { KeyInput } from '../oddvar/protocol';

export class LocalPlayer extends Deadly implements Player
{
	public input = new Array<KeyInput>();
	private _sync = -1;
	private _wasSnapshot = false;

	public get sync() : number {
		return this._sync;
	}

	public get wasSnapshot(): boolean {
		return this._wasSnapshot;
	}

	constructor(name: string, public readonly id: number) {
		super(name);
	}

	public get isCurrent () : boolean {
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

export class LocalPlayers extends DeadlyWorld<LocalPlayer> implements Players
{
	private player?: LocalPlayer;

	constructor() {
		super();
		document.addEventListener("keydown", ev => {
			const input: KeyInput = { action: "down", key: ev.code, sync: Date.now() };
			this.SetInput(input);
		})
		document.addEventListener("keyup", ev => {
			const input: KeyInput = { action: "up", key: ev.code, sync: Date.now()};
			this.SetInput(input);
		})
	}

	private SetInput(input: KeyInput) {
		this.player?.input.push(input);
	}

	private AddPlayer(player: LocalPlayer): LocalPlayer {
		if (player.isCurrent) {
			this.player = player;
			player.DeathSubscribe(() => this.player = undefined);
		}
		return player;
	}

	CreatePlayer(name: string, id: number): Player {
		return this.AddPlayer(this.AddDeadly(new LocalPlayer(name, id)));
	}

	Tick(dt: number): void {
		if (this.player) {
			this.player.input.length = 0;
		}
		this.player?.Tick(dt);
	}
}