import { Bot, Evaluator } from "./bot";
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

	type СкептикSettings = {
		threshold: number;
	};

	export class Скептик implements Evaluator {
		private threshold: number
		constructor({ threshold }: СкептикSettings) { this.threshold = threshold; }
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
					const threshold = this.threshold * (bot.map.maze.width + bot.map.maze.height);
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
