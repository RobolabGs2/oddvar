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
			const res = msg.read({
				"captured": () => true,
				"empty": () => true,
				"target": (msg) => {
					const path = bot.map.findPath(bot.location, msg.data);
					if (path === undefined)
						return false;
					const threshold = this.distanceThreshold * (bot.map.maze.width + bot.map.maze.height);
					return path.length <= threshold
				}
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