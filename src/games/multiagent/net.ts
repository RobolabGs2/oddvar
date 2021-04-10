import { DeadlyWorld, StatelessDeadly } from "../../oddvar/base";
import { Point } from "../../oddvar/geometry";
import { EventHandler } from "../../oddvar/utils";

interface MessageDataMap {
	target: Point;
}

export class Message<T extends keyof MessageDataMap = keyof MessageDataMap> {
	constructor(
		readonly from: string,
		readonly to: string,
		readonly type: T,
		readonly data: MessageDataMap[T]
	) { }
}

export class NetworkCard extends StatelessDeadly {
	constructor(name: string, readonly address: string) { super(name) }
	ToConstructor(): any[] {
		return [this.address];
	}
	out = new Map<string, Message>();
	in = new Array<Message>();
	send<T extends keyof MessageDataMap>(to: string, type: T, data: MessageDataMap[T]) {
		this.out.set(to, new Message(this.address, to, type, data));
	}

	readAll(handler: EventHandler<MessageDataMap>) {
		this.in.forEach(message => handler[message.type](message.data))
		this.in.length = 0;
	}
}

export class Network extends DeadlyWorld<NetworkCard> {
	cards: Map<string, NetworkCard> = new Map();

	CreateNetworkCard(name: string, address: string): NetworkCard {
		const card = new NetworkCard(name, address);
		this.cards.set(address, card);
		card.DeathSubscribe(() => this.cards.delete(name));
		return this.AddDeadly(card);
	}

	Tick(dt: number): void {
		this.cards.forEach(card => {
			card.out.forEach((message, to) => {
				this.cards.get(to)?.in.push(message);
			})
			card.out.clear();
		})
	}
}
