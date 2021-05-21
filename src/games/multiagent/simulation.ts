import { Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { RectangleTexture } from '../../oddvar/textures';
import { Target } from "../utils/target";
import { WallManager } from "../utils/wall_manager";
import { GameMap } from "../utils/game_map";
import { DataMatrix, MatrixCell } from '../../oddvar/labirint/labirint';
import { Iterators } from '../../oddvar/iterator';
import { GameLogic, MetricsSource } from '../../oddvar/manager';
import { Bot, Evaluator, Evaluators, Middlewares, SendMiddleware } from './bot';
import { MessageDataMap, Network } from './net';
import { ConvertRecord, Observable } from '../../oddvar/utils';
import { TableModel, WindowsManager } from '../../web/windows';
import { IsGameMap, SimulatorDescription } from '../utils/description';
import { HTML } from '../../web/html';

interface BotTableLine {
	name: string;
	score: number;
	evaluator: string;
	sender: string;
}

class BotTable extends Observable<{ updated: number }> implements TableModel<BotTable, keyof BotTableLine> {
	fields: BotTableLine[] = [];
	addBot(bot: Bot) {
		this.fields.push({ name: bot.name, score: -1, evaluator: bot.evaluator.constructor.name, sender: bot.sender.constructor.name });
	}
	updateScore(i: number) {
		this.fields[i].score++;
		this.dispatchEvent("updated", i);
	}
}


export namespace Multiagent {
	const evaluators: Evaluator[] = [new Evaluators.Доверчивый, new Evaluators.Скептик, new Evaluators.Параноик];
	const senders: SendMiddleware[] = [new Middlewares.Честный, new Middlewares.Лжец];
	const strategiesArray = Iterators.zip(Iterators.Range(evaluators.length * senders.length).map(i => evaluators[i % evaluators.length]).toArray(), Iterators.Range(evaluators.length * senders.length).map(i => senders[(i / evaluators.length) | 0]).toArray());
	const strategies = Object.fromEntries(strategiesArray.map((pair) => [pair.map(x => x.constructor.name).reverse().join("_"), pair]));

	export type Settings = {
		bots: Record<keyof typeof strategies, number>,
		debug: {
			network: boolean,
			map: boolean,
			botsThinking: boolean
		}
	}
	export const Description: SimulatorDescription<Settings, GameMap> = {
		name: "Равноранговая многоагентная система",
		NewSimulation: (oddvar, map, ui, settings) => new Simulation(oddvar, map, ui, settings),
		IsSupportedMap: IsGameMap,
		SettingsInputType() {
			return {
				bots: { type: "object", values: ConvertRecord(strategies, () => (<HTML.Input.Type>{ type: "int", default: 1 })) },
				debug: {
					type: "object", description: "Настройки вывода отладочной информации", values: {
						network: { type: "boolean", default: true, description: "Отображать логи сети" },
						map: { type: "boolean", default: false, description: "Отображать карту бота 0" },
						botsThinking: { type: "boolean", default: true, description: "Отображать, куда бот собирается идти" }
					}
				}
			}
		},
	}

	export class Simulation implements GameLogic, MetricsSource {
		bots: Bot[]
		wallManager = new WallManager(this.oddvar);
		private network: Network;
		private targetMap: DataMatrix<boolean | Map<string, Point>>
		private score: BotTable;
		constructor(readonly oddvar: Oddvar, private map: GameMap, winMan: WindowsManager, settings: Settings) {
			if (settings.debug.map) console.log(this.map.maze.toString())
			if (settings.debug.network) {
				const logHeight = 350;
				const networkLogs = winMan.CreateConsoleWindow<keyof MessageDataMap>("Network", new Point(map.size.width, map.size.height - logHeight - 48), new Size(30, 30 / 450 * logHeight), {
					empty: { color: "white", fontWeight: "1000" },
					target: { color: "lime" },
					captured: { color: "red", fontWeight: "1000", fontStyle: "italic" },
				});
				const p2s = (p: Point) => `(${(p.x / 100).toFixed(2).slice(2)}, ${(p.y / 100).toFixed(2).slice(2)})`
				this.network = new Network(
					(msg => {
						networkLogs.WriteLine(msg.type,
							[
								[msg.from.padEnd(10), msg.to.padStart(10)].join(" -> ").padEnd(30),
								msg.type.padEnd(10),
								(msg.data instanceof Point ? p2s(map.toMazeCoords(msg.data)) : msg.type).padEnd(10),
								msg.timestamp.toFixed(2).padStart(10)
							].join(" "))
					}), oddvar.Clock);
			} else {
				this.network = new Network(() => { }, oddvar.Clock);
			}
			this.score = new BotTable();
			map.Draw(this.wallManager.creator)
			this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
			const nameOfBot = (i: number) => `Bot ${i}`
			let botsCount = 0;
			this.bots = [];
			for (const type in settings.bots) {
				const count = settings.bots[type];
				const [e, s] = strategies[type];
				for (let i = botsCount; i < botsCount + count; i++) {
					this.bots.push(new Bot(nameOfBot(i),
						this.oddvar, this.GenerateInconflictPoint(10, 1 << i), this.map.cellSize.Scale(3 / 7),
						this.getTexture(i), this.map, i, this.network.CreateNetworkCard(`Bot card ${i}`, nameOfBot(i)), e, s, settings.debug.botsThinking))
				}
				botsCount += count;
			}

			if (settings.debug.map) {
				const mapLogger = winMan.CreateLoggerWindow(`Map ${this.bots[0].name}`, new Point(map.size.width * 1.70, 0), new Size(map.maze.width * 1.6, map.maze.height * 2 * 5));
				this.bots[0].addEventListener("mapUpdated", (map => {
					mapLogger.WarnLine(oddvar.Clock.now().toFixed(2))
					mapLogger.InfoLine(map.toString())
				}))
			}

			const targetSize = this.map.cellSize.Scale(1 / 5);
			const targetName = (i: number, name: string) => `target_${i} ${name}`

			this.bots.map((bot, i) => {
				this.score.addBot(bot);
				const layers = 1 << i;
				const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), this.GenerateInconflictPoint(targetSize.width, layers));
				const targetBody = oddvar.Get("Physics").CreateRectangleBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize);
				oddvar.Get("Graphics").CreateRectangleBodyAvatar(targetName(i, "avatar"), targetBody, this.getTexture(i));
				oddvar.Get("Graphics").CreateCircleEntityAvatar(targetName(i, "avatar circle"), targetPoint, targetSize.width * 0.9, bot.color);
				const target = new Target<number>(targetBody);
				target.addEventListener("relocate", (p) => {
					const old = this.map.toMazeCoords(p.from);
					const now = this.map.toMazeCoords(p.to);
					(<Map<string, Point>>this.targetMap.get(old.x, old.y)).delete(bot.name);
					(<Map<string, Point>>this.targetMap.get(now.x, now.y)).set(bot.name, p.to);
					bot.resetMap();
					this.score.updateScore(i);
				});
				target.addEventListener("collision", () => {
					const newLocation = this.GenerateInconflictPoint(targetSize.width, layers);
					target.relocate(newLocation)
				});
				target.players.set(bot.body, i);
				target.relocate(this.GenerateInconflictPoint(targetSize.width, layers));
			});
			winMan.CreateTableWindow("Score", this.score, ["name", "sender", "evaluator", "score"], new Point(map.size.width * 1.7, 0),
				this.bots.map(bot => (style) => style.backgroundColor = bot.color.Name))
		}
		CollectMetrics() {
			return {
				"score": this.score.fields
			}
		}

		private getTexture(i: number): RectangleTexture {
			return this.botTextures[i % this.botTextures.length];
		}

		time = 0
		Tick(dt: number): void {
			if (dt > 1) {
				dt = 1;
			}
			this.time += dt;
			if (this.time > 0.1) {
				this.network.Tick(this.time);
				this.time = 0;
			}
			this.bots.forEach(bot => {
				const l = bot.map.toMazeCoords(bot.location);
				bot.Tick(this.time, this.targetMap.BFS(l, 2, true) as MatrixCell<Map<string, Point>>[])
			});
			this.bots.forEach(bot => bot.TickBody(dt));
		}

		protected GenerateInconflictPoint(distance: number, layers: number = -1): Point {
			let p = new Point((Math.random() * this.map.maze.width) | 0, (Math.random() * this.map.maze.height) | 0);
			if (this.map.maze.get(p.x, p.y) || this.oddvar.Get("Physics").Map(this.map.fromMazeCoords(p), layers) < distance)
				return this.GenerateInconflictPoint(distance, layers);
			return this.map.fromMazeCoords(p);
		}

		private botTextures = Iterators.Range(2).map(i => this.oddvar.Get("TexturesManager").CreateImageTexture(`bot_${0}`, `monster_${i + 1}`)).toArray();

	}
}