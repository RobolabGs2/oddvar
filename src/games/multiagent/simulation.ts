import { Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { ColoredTexture, RectangleTexture, TexturesManager } from '../../oddvar/textures';
import { Target } from "../utils/target";
import { WallManager } from "../utils/wall_manager";
import { GameMap } from "../utils/game_map";
import { DataMatrix, MatrixCell } from '../../oddvar/labirint/labirint';
import { Iterators } from '../../oddvar/iterator';
import { GameLogic, MetricsSource } from '../../oddvar/manager';
import { Bot, HonestyBot, LierBot, RatingBot, SmartLierBot } from './bot';
import { Message, MessageDataMap, Network, NetworkCard } from './net';
import { ConvertRecord, Observable } from '../../oddvar/utils';
import { TableModel, WindowsManager } from '../../web/windows';
import { IsGameMap, SimulatorDescription } from '../utils/description';
import { HTML } from '../../web/html';
import { Entity } from '../../oddvar/world';
import { Evaluators } from './strategies';
import { PolygonBody } from '../../oddvar/physics/body';

interface BotTableLine {
	name: string;
	score: number;
	strategy: string;
}

class BotTable extends Observable<{ updated: number }> implements TableModel<BotTable, keyof BotTableLine> {
	fields: BotTableLine[] = [];
	addBot(bot: Bot, strategy: string) {
		this.fields.push({ name: bot.name, score: -1, strategy });
	}
	updateScore(i: number) {
		this.fields[i].score++;
		this.dispatchEvent("updated", i);
	}
}


function getByModule<T>(a: Array<T>, i: number): T {
	return a[(i % a.length) | 0];
}

export namespace Multiagent {

	type StrategyDescription = {
		CreateBot(
			strategiesSettings: Record<string, any>,
			name: string, oddvar: Oddvar, body: PolygonBody, color: ColoredTexture, map: GameMap, layer: number, network: NetworkCard, debug: boolean): Bot;
		StrategyName: string
	}


	const evaluators = [Evaluators.Доверчивый, Evaluators.Скептик, Evaluators.Параноик];
	const senders = <[typeof HonestyBot | typeof LierBot, string][]>[[HonestyBot, "Честный"], [LierBot, "Лжец"], [SmartLierBot, "ХитрыйЛжец"]];
	const strategiesCount = Iterators.Range(evaluators.length * senders.length).toArray();
	const strategiesArray = Iterators.zip(strategiesCount.map(i => getByModule(evaluators, i)), strategiesCount.map(i => senders[(i / evaluators.length) | 0]));
	const strategies = Object.fromEntries(strategiesArray.map((pair) => {
		return <StrategyDescription>{
			CreateBot(ss, name, o, b, c, m, l, n, d) { return new pair[1][0](new pair[0](ss[pair[0].name]), name, o, b, c, m, l, n, d) },
			StrategyName: `${pair[1][1]}_${pair[0].name}`,
		}
	}).concat(
		(<[string, number, number, number][]>[
			["Око_за_око", 0, 1, -1],
			["Злопамятный", 0, 0, -1],
			["Прощающий", -1, 1, -1],
		]
		).map(([name, threshold, trustPayoff, liePayoff]) => ({
			StrategyName: name,
			CreateBot(ss, name, o, b, c, m, l, n, d) { return new RatingBot(threshold, trustPayoff, liePayoff, name, o, b, c, m, l, n, d) },
		})
		)).map(strategy => [strategy.StrategyName, strategy]));

	const skins = {
		pretty: {
			wall: (o: TexturesManager) => o.CreatePatternTexture("wall", "bricks"),
			bot(oddvar: Oddvar, nameOf: (type: string) => string, entity: Entity, layer: number, size: Size, botTexture: RectangleTexture, color: ColoredTexture) {
				const body = oddvar.Get("Physics").CreateRectangleBody(nameOf("body"), entity, { lineFriction: 0.5, angleFriction: 0.1, layers: 1 << layer }, size);
				oddvar.Get("Graphics").CreateRectangleBodyAvatar(nameOf("body avatar"), body, botTexture);
				oddvar.Get("Graphics").CreateRectangleEntityAvatar(nameOf("body 2 avatar"), entity, size.Scale(1.1), color);
				return body;
			},
			target(oddvar: Oddvar, targetName: (i: number, name: string) => string, i: number, location: Point, layers: number, targetSize: Size, bot: Bot) {
				const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), location);
				const targetBody = oddvar.Get("Physics").CreateRegularPolygonBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize.width, 3);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(targetName(i, "avatar body"), targetBody, bot.color);
				oddvar.Get("Graphics").CreateCircleEntityAvatar(targetName(i, "avatar inner circle"), targetPoint, targetSize.width * 0.5, bot.color);
				targetBody.TurnKick(targetSize.Area() * 5000)
				const target = new Target<number>(targetBody);
				return target;
			},
			scale: 3 / 7
		},
		simple: {
			wall: (o: TexturesManager, cellSize: number) =>
				o.CreateHatchingTexture("wall", "grey", cellSize/*Math.max(cellSize / 6, 10)*/, cellSize),
			bot(oddvar: Oddvar, nameOf: (type: string) => string, entity: Entity, layer: number, size: Size, botTexture: RectangleTexture, color: ColoredTexture) {
				const body = oddvar.Get("Physics").CreateRegularPolygonBody(nameOf("body"), entity, { lineFriction: 0.5, angleFriction: 0.1, layers: 1 << layer }, size.width / 2, 10);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(nameOf("body avatar"), body, color);
				oddvar.Get("Graphics").CreateLabelEntityAvatar(nameOf("index"), entity, layer.toString(), size.width / 3 * 2,
					oddvar.Get("TexturesManager").CreateColoredTexture("twt", { fill: color.settings.stroke }),
				)
				return body;
			},
			target(oddvar: Oddvar, targetName: (i: number, name: string) => string, i: number, location: Point, layers: number, targetSize: Size, bot: Bot) {
				const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), location);
				const targetBody = oddvar.Get("Physics").CreateRegularPolygonBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize.width, 3);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(targetName(i, "avatar circle"), targetBody, bot.color);
				oddvar.Get("Graphics").CreateLabelEntityAvatar(targetName(i, "index"), targetPoint, i.toString(), targetSize.width / 3 * 2,
					oddvar.Get("TexturesManager").CreateColoredTexture("twt", { fill: bot.color.settings.stroke }),
				)
				const target = new Target<number>(targetBody);
				return target;
			},
			scale: 4 / 7
		}
	}
	export type Settings = {
		bots: Record<keyof typeof strategies, number>,
		strategies: {
			"Скептик": {
				threshold: number
			},
		}
		debug: {
			network: boolean,
			map: boolean,
			botsThinking: boolean
		},
		skin: keyof typeof skins;
		errorRate: number;
	}


	const Colors = [
		"blue", "red", "green",
		"purple", "peru", "plum"
	];
	export const Description: SimulatorDescription<Settings, GameMap> = {
		name: "Равноранговая многоагентная система",
		NewSimulation: (oddvar, map, ui, settings) => new Simulation(oddvar, map, ui, settings),
		IsSupportedMap: IsGameMap,
		SettingsInputType() {
			return {
				skin: { type: 'enum', default: "pretty", values: ConvertRecord(skins, (k) => k), description: "Набор текстур" },
				errorRate: { type: 'float', min: 0, max: 1, default: 0, description: "Вероятность искажения сообщения о найденной цели" },
				bots: { type: "object", values: ConvertRecord(strategies, () => (<HTML.Input.Type>{ type: "int", default: 1, min: 0 })) },
				strategies: {
					type: "object", description: "Настройки стратегий", values: {
						Скептик: {
							type: "object", values: {
								threshold: {
									type: "float", default: 0.4, min: 0, max: 1,
									description: "Максимальное расстояние до точки, которой поверит скептик\nВ процентах от стороны карты"
								}
							}
						}
					}
				},
				debug: {
					type: "object", description: "Настройки вывода отладочной информации", values: {
						network: { type: "boolean", default: true, description: "Отображать логи сети" },
						map: { type: "boolean", default: false, description: "Отображать карту бота 0" },
						botsThinking: { type: "boolean", default: true, description: "Отображать, куда бот собирается идти" }
					}
				},
			} as Record<keyof Settings, HTML.Input.Type>
		},
	}

	export class Simulation implements GameLogic, MetricsSource {
		bots: Bot[]
		private network: Network;
		private targetMap: DataMatrix<boolean | Map<string, Point>>
		private score: BotTable;
		constructor(readonly oddvar: Oddvar, private map: GameMap, winMan: WindowsManager, settings: Settings) {
			const skin = skins[settings.skin];
			if (settings.debug.map) console.log(this.map.maze.toString())
			this.score = new BotTable();
			this.network = this.createNetwork(winMan, settings.errorRate, settings.debug.network);
			const wallManager = new WallManager(this.oddvar, skin.wall(oddvar.Get("TexturesManager"), map.cellSize.width));
			map.Draw(wallManager.creator);

			this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
			const nameOfBot = (i: number) => `Bot ${i}`
			let botsCount = 0;
			const botSize = this.map.cellSize.Scale(skin.scale);
			this.bots = [];
			for (const type in settings.bots) {
				const count = settings.bots[type];
				const botDesc = strategies[type];
				if (botDesc === undefined) continue;
				for (let i = botsCount; i < botsCount + count; i++) {
					const layer = i;
					const place = this.GenerateInconflictPoint(10, 1 << i);
					const botTexture = this.getTexture(0)//senders.findIndex(x => x === botConstructor));
					const nameOf = (type: string) => `bot ${layer}: ${type}`;
					const currentColor = Colors.length > layer ? Colors[layer] : `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
					const color = oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { stroke: currentColor, strokeWidth: 3 });
					const entity = oddvar.Get("World").CreateEntity(nameOf("entity"), place);
					const body = skin.bot(oddvar, nameOf, entity, layer, botSize, botTexture, color);
					const bot = botDesc.CreateBot(settings.strategies, nameOfBot(i),
						this.oddvar, body, color, this.map, i, this.network.CreateNetworkCard(`Bot card ${i}`, nameOfBot(i)), settings.debug.botsThinking);
					this.bots.push(bot);
					this.score.addBot(bot, botDesc.StrategyName);
				}
				botsCount += count;
			}

			if (settings.debug.map) {
				const mapLogger = winMan.CreateLoggerWindow(`Map ${this.bots[0].name}`, new Point(map.size.width * 2, 0), new Size(map.maze.width * 1.6, map.maze.height * 2 * 5));
				this.bots[0].addEventListener("mapUpdated", (map => {
					mapLogger.WarnLine(oddvar.Clock.now().toFixed(2))
					mapLogger.InfoLine(map.toString())
				}))
			}

			const targetSize = this.map.cellSize.Scale(2 / 7);
			const targetName = (i: number, name: string) => `target_${i} ${name}`

			this.bots.map((bot, i) => {
				const layers = 1 << i;
				const location = this.GenerateInconflictPoint(targetSize.width, layers);
				const target = skin.target(oddvar, targetName, i, location, layers, targetSize, bot);
				target.addEventListener("relocate", (p) => {
					const old = this.map.toMazeCoords(p.from);
					const now = this.map.toMazeCoords(p.to);
					(<Map<string, Point>>this.targetMap.get(old.x, old.y)).delete(bot.name);
					(<Map<string, Point>>this.targetMap.get(now.x, now.y)).set(bot.name, p.to);
					bot.captured(p.from);
					this.score.updateScore(i);
				});
				target.addEventListener("collision", () => {
					const newLocation = this.GenerateInconflictPoint(targetSize.width, layers);
					target.relocate(newLocation)
				});
				target.players.set(bot.body, i);
				target.relocate(this.GenerateInconflictPoint(targetSize.width, layers));
			});
			winMan.CreateTableWindow("Score", this.score, ["name", "strategy", "score"], new Point(map.size.width / 2, map.size.width),
				this.bots.map(bot => (style) => style.backgroundColor = bot.color.Name))
		}
		private createNetwork(winMan: WindowsManager, errorRate: number, debug: boolean) {
			const mitm = (msg: Message<keyof MessageDataMap>): Message<keyof MessageDataMap> => {
				if (msg.is("target") && Math.random() < errorRate) {
					return new Message(msg.from, msg.to, msg.type, this.map.randomFreePoint(), msg.timestamp);
				}
				return msg;
			};
			if (!debug) {
				return new Network(mitm, this.oddvar.Clock);
			}
			const logHeight = 350;
			const networkLogs = winMan.CreateConsoleWindow<keyof MessageDataMap>("Network",
				new Point(this.map.size.width, this.map.size.height - logHeight - 48),
				new Size(30, 30 / 450 * logHeight), {
				target: { color: "lime" },
				captured: { color: "red", fontWeight: "1000", fontStyle: "italic" },
			});
			const p2s = (p: Point) => `(${(p.x / 100).toFixed(2).slice(2)}, ${(p.y / 100).toFixed(2).slice(2)})`;
			return new Network(
				(msg => {
					msg = mitm(msg);
					networkLogs.WriteLine(msg.type,
						[
							[msg.from.padEnd(10), msg.to.padStart(10)].join(" -> ").padEnd(30),
							msg.type.padEnd(10),
							(msg.data instanceof Point ? p2s(this.map.toMazeCoords(msg.data)) : msg.type).padEnd(10),
							msg.timestamp.toFixed(2).padStart(10)
						].join(" "));
					return msg;
				}), this.oddvar.Clock);
		}

		CollectMetrics() {
			return {
				"score": this.score.fields
			}
		}

		private getTexture(i: number): RectangleTexture {
			return getByModule(this.botTextures, i);
		}

		Tick(dt: number): void {
			this.network.Tick(dt);
			this.bots.forEach(bot => {
				const l = bot.map.toMazeCoords(bot.location);
				bot.Tick(dt, this.targetMap.BFS(l, 2, true) as MatrixCell<Map<string, Point>>[])
			});
			this.bots.forEach(bot => bot.TickBody(dt));
		}

		protected GenerateInconflictPoint(distance: number, layers: number = -1): Point {
			return this.map.randomFreePoint((p) => this.oddvar.Get("Physics").Map(this.map.fromMazeCoords(p), layers) >= distance);
		}

		private botTextures = Iterators.Range(2).map(i => this.oddvar.Get("TexturesManager").CreateImageTexture(`bot_${0}`, `monster_${i + 1}`)).toArray();

	}
}