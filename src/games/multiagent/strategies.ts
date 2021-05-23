import { Point } from "../../oddvar/geometry";
import { Bot, Evaluator, SendMiddleware } from "./bot";
import { Message, MessageDataMap } from "./net";



export namespace Evaluators {
	export class Доверчивый implements Evaluator {
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			return true;
		}
	}

	export class Скептик implements Evaluator {
		constructor(readonly distanceThreshold = 0.4) { }
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			let res = false;
			msg.read({
				"captured": () => res = true,
				"empty": () => res == true,
				"target": (msg) => !bot.map.isExplored(msg.data) && (bot.map.findPath(bot.location, msg.data)?.length || Infinity) < this.distanceThreshold*bot.map.maze.width
			})
			return res;
		}
	}

	export class Параноик implements Evaluator {
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			return false;
		}
	}
}


export namespace Middlewares {
	export class Честный implements SendMiddleware {
		Send<T extends keyof MessageDataMap>(bot: Bot, to: string, type: T, data: MessageDataMap[T]): void {
			bot.network.send(to, type, data);
		}
	}
	export class Лжец implements SendMiddleware {
		Send<T extends keyof MessageDataMap>(bot: Bot, to: string, type: T, data: MessageDataMap[T]): void {
			switch (type) {
				case "captured":
					bot.network.send(to, type, data);
					break;
				case "empty":
					bot.network.send(to, type, data); // todo
					break;
				case "target":
					const target = data as MessageDataMap["target"];
					bot.network.send(to, type as "target", new Point(bot.map.size.width - target.x, bot.map.size.height - target.y))
			}
		}
	}
}