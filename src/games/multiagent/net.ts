import { DeadlyWorld, StatelessDeadly } from "../../oddvar/base";
import { Point } from "../../oddvar/geometry";
import { Clock } from "../../oddvar/oddvar";
import { EventHandler } from "../../oddvar/utils";

export interface MessageDataMap {
	target: Point;
	captured: boolean;
}

export type MessageMap = {
	[K in keyof MessageDataMap]: Message<K>
}

export class Message<T extends keyof MessageDataMap = keyof MessageDataMap> {
	constructor(
		readonly from: string,
		readonly to: string | "broadcast",
		readonly type: T,
		readonly data: MessageDataMap[T],
		readonly timestamp: number
	) { }

	read<T = void>(handler: EventHandler<MessageMap, unknown, T>): T {
		return handler[this.type](this as never); // ts оказался недостаточно силён для зависимых типов
	}
}

export class NetworkCard extends StatelessDeadly {
	constructor(name: string, readonly address: string, readonly clock: Clock) { super(name) }
	ToConstructor(): any[] {
		return [this.address];
	}
	out = new Array<Message>();
	broadcastOut = new Array<Message>();
	in = new Array<Message>();
	send<T extends keyof MessageDataMap>(to: string, type: T, data: MessageDataMap[T]) {
		this.out.push(new Message(this.address, to, type, data, this.clock.now()));
	}

	broadcast<T extends keyof MessageDataMap>(type: T, data: MessageDataMap[T]) {
		this.broadcastOut.push(new Message(this.address, "broadcast", type, data, this.clock.now()));
	}

	readAll(handler: EventHandler<MessageMap>) {
		this.in.forEach(message => message.read(handler));
		this.in.length = 0;
	}
}

export class Network extends DeadlyWorld<NetworkCard> {
	cards: Map<string, NetworkCard> = new Map();

	constructor(readonly mitm: (msg: Message) => void, readonly clock: Clock) {
		super();
	}

	CreateNetworkCard(name: string, address: string): NetworkCard {
		const card = new NetworkCard(name, address, this.clock);
		this.cards.set(address, card);
		card.DeathSubscribe(() => this.cards.delete(name));
		return this.AddDeadly(card);
	}
	Tick(dt: number): void {
		this.cards.forEach(card => {
			card.broadcastOut.forEach((message) => {
				this.mitm(message);
				this.cards.forEach(destination => {
					if (destination.address === message.from)
						return;
					destination.in.push(message);
				});
			});
			card.out.forEach((message) => {
				this.cards.get(message.to)?.in.push(message);
				this.mitm(message);
			});
			card.broadcastOut.length = 0;//clear();
			card.out.length = 0;//clear();
		})
	}
}
