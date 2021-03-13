
import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';

export class ClientPlayer extends Player
{
	public input = new Array<string>();

	constructor(name: string, public readonly id: number) {
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
	private players = new Map<number, ClientPlayer>();
	public myId = -1;

	constructor(ws: WebSocket) {
		super();
		document.addEventListener("keydown", ev => {
			ws.send(ev.key);
		})
	}

	private AddPlayer(player: ClientPlayer): ClientPlayer {
		this.players.set(player.id, player);
		player.DeathSubscribe(() => this.players.delete(player.id));
		return player;
	}

	CreatePlayer(name: string, id: number): Player {
		return this.AddPlayer(this.AddDeadly(new ClientPlayer(name, id)));
	}

	Tick(dt: number): void {
	}
}