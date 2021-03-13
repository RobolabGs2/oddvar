
import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';
import { CreateClientMessage, KeyInput } from '../oddvar/protocol';

export class ClientPlayer extends Player
{
	public input = new Array<KeyInput>();

	constructor(name: string, public readonly id: number, readonly isCurrent: boolean) {
		super(name);
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
	}
}

export class ClientPlayers extends DeadlyWorld<ClientPlayer> implements Players
{
	private player?: ClientPlayer;
	public myId = -1;

	constructor(ws: WebSocket) {
		super();
		document.addEventListener("keydown", ev => {
			const input: KeyInput = { action: "down", key: ev.code};
			ws.send(CreateClientMessage("input", input))
			this.SetInput(input);
		})
		document.addEventListener("keyup", ev => {
			const input: KeyInput = { action: "up", key: ev.code};
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
	}
}