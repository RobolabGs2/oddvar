
import { KeyInput } from 'oddvar/protocol';
import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';

export class ServerPlayer extends Player
{
	readonly isCurrent = false;
	public input = new Array<KeyInput>();

	constructor(name: string, public readonly id: number) {
		super(name);
	}

	public Tick(dt: number) {
		this.input.length = 0;
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

export class ServerPlayers extends DeadlyWorld<ServerPlayer> implements Players
{
	private players = new Map<number, ServerPlayer>();

	constructor() {
		super();
	}

	public AddUserInput(id: number, input: KeyInput) {
		this.players.get(id)?.input.push(input);
	}

	private AddPlayer(player: ServerPlayer): ServerPlayer {
		this.players.set(player.id, player);
		player.DeathSubscribe(() => this.players.delete(player.id));
		return player;
	}

	CreatePlayer(name: string, id: number): Player {
		return this.AddPlayer(this.AddDeadly(new ServerPlayer(name, id)));
	}

	Tick(dt: number): void {
		this.mortals.forEach(p => p.Tick(dt))
	}
}