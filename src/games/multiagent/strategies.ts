import { Point } from "../../oddvar/geometry";
import { Random } from "../../oddvar/utils/random";
import { Bot, Evaluator, SendMiddleware } from "./bot";
import { Message, MessageDataMap } from "./net";



export namespace Evaluators {
	export class Доверчивый implements Evaluator {
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			return msg.read({
				"captured": () => true,
				"target": (msg) => {
					const maze = bot.map.toMazeCoords(msg.data);
					return !bot.map.isConflict(maze.x, maze.y, msg.data);
				}
			});
		}
	}

	export class Скептик implements Evaluator {
		constructor(readonly distanceThreshold = 0.4) { }
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			return msg.read({
				"captured": () => true,
				"target": (msg) => {
					const mazeCoords = bot.map.toMazeCoords(msg.data);
					if (bot.map.isConflict(mazeCoords.x, mazeCoords.y, msg.data))
						return false;
					const path = bot.map.findPath(bot.location, msg.data);
					if (path === undefined)
						return false;
					const threshold = this.distanceThreshold * (bot.map.maze.width + bot.map.maze.height);
					return path.length <= threshold
				}
			});
		}
	}

	export class Параноик implements Evaluator {
		Evaluate(bot: Bot, msg: Message<keyof MessageDataMap>): boolean {
			return msg.read({
				"captured": () => true,
				"target": () => false,
			});
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
				case "target":
					const targetMazeCoodrs = bot.map.toMazeCoords(data as MessageDataMap["target"]);
					const minDistance = (bot.map.maze.width + bot.map.maze.height)*0.4;
					let fake = new Point(Random.Int(0, bot.map.maze.width), Random.Int(0, bot.map.maze.height));
					while (targetMazeCoodrs.Manhattan(fake)<minDistance || bot.map.maze.get(fake.x, fake.y)) {
						fake = new Point(Random.Int(0, bot.map.maze.width), Random.Int(0, bot.map.maze.height));
					}
					bot.network.send(to, type as "target", bot.map.fromMazeCoords(fake));
			}
		}
	}
}