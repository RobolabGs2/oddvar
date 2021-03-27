import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';
import { CreateClientMessage, KeyInput } from '../oddvar/protocol';
import { Keyboard } from "../oddvar/input";

export class ClientPlayer extends Deadly implements Player
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

	constructor(name: string, public readonly id: number, readonly isCurrent: boolean) {
		super(name);
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

export class ClientPlayers extends DeadlyWorld<ClientPlayer> implements Players
{
	private player?: ClientPlayer;
	public myId = -1;

	constructor(ws: WebSocket, keyboard: Keyboard) {
		super();
		keyboard.addEventListener("pressKey", (input) => {
			ws.send(CreateClientMessage("input", input))
			this.SetInput(input);
		})
	}

	private SetInput(input: KeyInput) {
		this.player?.input.push(input);
	}

	private AddPlayer(player: ClientPlayer): ClientPlayer {
		if (player.isCurrent) {
			this.player = player;
			player.DeathSubscribe(() => this.player = undefined);
		}
		return player;
	}

	CreatePlayer(name: string, id: number): Player {
		return this.AddPlayer(this.AddDeadly(new ClientPlayer(name, id, id == this.myId)));
	}

	Tick(dt: number): void {
		if (this.player) {
			this.player.input.length = 0;
		}
		this.player?.Tick(dt);
	}
}