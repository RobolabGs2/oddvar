
import { Deadly, DeadlyWorld } from '../oddvar/base';
import { Players, Player } from '../oddvar/players';

export class ServerPlayer extends Player
{
	public input = new Array<string>();

	constructor(name: string, public readonly id: number) {
		super(name);
	}

	public Tick(dt: number) {
		if(this.input.length > 0)
			console.log(this.id, this.input);
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

	public AddUserInput(id: number, input: string) {
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