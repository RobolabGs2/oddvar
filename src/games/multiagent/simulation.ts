import { Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { ColoredTexture, RectangleTexture, TexturesManager } from '../../oddvar/textures';
import { Target } from "../utils/target";
import { WallManager } from "../utils/wall_manager";
import { GameMap } from "../utils/game_map";
import { DataMatrix, MatrixCell } from '../../oddvar/labirint/labirint';
import { Iterators } from '../../oddvar/iterator';
import { GameLogic, MetricsSource } from '../../oddvar/manager';
import { Bot } from './bot';
import { MessageDataMap, Network } from './net';
import { ConvertRecord, Observable } from '../../oddvar/utils';
import { TableModel, WindowsManager } from '../../web/windows';
import { IsGameMap, SimulatorDescription } from '../utils/description';
import { HTML } from '../../web/html';
import { Entity } from '../../oddvar/world';
import { Evaluators, Middlewares } from './strategies';

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


function getByModule<T>(a: Array<T>, i: number): T {
	return a[(i % a.length) | 0];
}

export namespace Multiagent {
	const evaluators = [Evaluators.Доверчивый, Evaluators.Скептик, Evaluators.Параноик];
	const senders = [Middlewares.Честный, Middlewares.Лжец];
	const strategiesCount = Iterators.Range(evaluators.length * senders.length).toArray();
	const strategiesArray = Iterators.zip(strategiesCount.map(i => getByModule(evaluators, i)), strategiesCount.map(i => senders[(i / evaluators.length) | 0]));
	const strategies = Object.fromEntries(strategiesArray.map((pair) => [pair.map(x => x.name).reverse().join("_"), pair]));

	const skins = {
		pretty: {
			wall: (o: TexturesManager) => o.CreatePatternTexture("wall", "bricks"),
			bot(oddvar: Oddvar, nameOf: (type: string) => string, entity: Entity, layer: number, size: Size, botTexture: RectangleTexture, color: ColoredTexture) {
				const body = oddvar.Get("Physics").CreateRectangleBody(nameOf("body"), entity, { lineFriction: 0.1, angleFriction: 0.1, layers: 1 << layer }, size);
				oddvar.Get("Graphics").CreateRectangleBodyAvatar(nameOf("body avatar"), body, botTexture);
				oddvar.Get("Graphics").CreateRectangleEntityAvatar(nameOf("body 2 avatar"), entity, size.Scale(1.1), color);
				// oddvar.Get("Graphics").CreateRectanEntityAvatar(nameOf("circle avatar"), entity, size.width * 0.9, color);
				return body;
			},
			target(oddvar: Oddvar, targetName: (i: number, name: string) => string, i: number, location: Point, layers: number, targetSize: Size, bot: Bot) {
				const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), location);
				const targetBody = oddvar.Get("Physics").CreateRegularPolygonBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize.width, 3);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(targetName(i, "avatar circle"), targetBody, bot.color);
				oddvar.Get("Graphics").CreateCircleEntityAvatar(targetName(i, "avatar circle"), targetPoint, targetSize.width * 0.5, bot.color);
				targetBody.TurnKick(targetSize.Area() * 5000)
				const target = new Target<number>(targetBody);
				return target;
			}
		},
		simple: {
			wall: (o: TexturesManager, cellSize: number) =>
				o.CreateHatchingTexture("wall", "grey", cellSize/*Math.max(cellSize / 6, 10)*/, cellSize),
			bot(oddvar: Oddvar, nameOf: (type: string) => string, entity: Entity, layer: number, size: Size, botTexture: RectangleTexture, color: ColoredTexture) {
				const body = oddvar.Get("Physics").CreateRegularPolygonBody(nameOf("body"), entity, { lineFriction: 0.1, angleFriction: 0.1, layers: 1 << layer }, size.width / 2, 10);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(nameOf("body avatar"), body, color);
				// const textJoint = oddvar.Get("World").CreateTailEntity(nameOf("text joint"), entity, new Point(0, size.width/3))
				oddvar.Get("Graphics").CreateLabelEntityAvatar(nameOf("index"), entity, layer.toString(), size.width / 3 * 2,
					oddvar.Get("TexturesManager").CreateColoredTexture("twt", { fill: color.settings.stroke }),
				)
				return body;
			},
			target(oddvar: Oddvar, targetName: (i: number, name: string) => string, i: number, location: Point, layers: number, targetSize: Size, bot: Bot) {
				const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), location);
				const targetBody = oddvar.Get("Physics").CreateRegularPolygonBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize.width, 3);
				oddvar.Get("Graphics").CreatePolygonBodyAvatar(targetName(i, "avatar circle"), targetBody, bot.color);
				// const textJoint = oddvar.Get("World").CreateTailEntity(targetName(i, "text joint"), targetPoint, new Point(0, targetSize.width/3))
				oddvar.Get("Graphics").CreateLabelEntityAvatar(targetName(i, "index"), targetPoint, i.toString(), targetSize.width / 3 * 2,
					oddvar.Get("TexturesManager").CreateColoredTexture("twt", { fill: bot.color.settings.stroke }),
				)
				const target = new Target<number>(targetBody);
				return target;
			}
		}
	}
	export type Settings = {
		bots: Record<keyof typeof strategies, number>,
		strategies: {
			"Скептик": {
				treshold: number
			},
		}
		debug: {
			network: boolean,
			map: boolean,
			botsThinking: boolean
		},
		skin: keyof typeof skins;
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
				bots: { type: "object", values: ConvertRecord(strategies, () => (<HTML.Input.Type>{ type: "int", default: 1 })) },
				strategies: {type: "object", description: "Настройки стратегий", values: {Скептик:{
					type:"object", values: {treshold: {type: "float", default: 0.4, min: 0.01, max: 1, 
					description: "Максимальное расстояние до точки, которой поверит скептик\nВ процентах от стороны карты"}}
				}}},
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

			const wallManager = new WallManager(this.oddvar, skins[settings.skin].wall(oddvar.Get("TexturesManager"), map.cellSize.width));
			map.Draw(wallManager.creator);

			this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
			const nameOfBot = (i: number) => `Bot ${i}`
			let botsCount = 0;
			const botSize = this.map.cellSize.Scale(4 / 7);
			this.bots = [];
			for (const type in settings.bots) {
				const count = settings.bots[type];
				const [eConstructor, sConstructor] = strategies[type];
				for (let i = botsCount; i < botsCount + count; i++) {
					const e = eConstructor.name === "Скептик" ? new eConstructor(settings.strategies.Скептик.treshold): new eConstructor();
					const s = new sConstructor();
					const layer = i;
					const place = this.GenerateInconflictPoint(10, 1 << i);
					const botTexture = this.getTexture(senders.findIndex(x=>x===sConstructor));
					const nameOf = (type: string) => `bot ${layer}: ${type}`;
					const currentColor = Colors.length > layer ? Colors[layer] : `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
					const color = oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { stroke: currentColor, strokeWidth: 3 });
					const entity = oddvar.Get("World").CreateEntity(nameOf("entity"), place);
					const body = skins[settings.skin].bot(oddvar, nameOf, entity, layer, botSize, botTexture, color);
					this.bots.push(new Bot(nameOfBot(i),
						this.oddvar, body, color, this.map, i, this.network.CreateNetworkCard(`Bot card ${i}`, nameOfBot(i)), e, s, settings.debug.botsThinking))
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
				this.score.addBot(bot);
				const layers = 1 << i;
				const location = this.GenerateInconflictPoint(targetSize.width, layers);
				const target = skins[settings.skin].target(oddvar, targetName, i, location, layers, targetSize, bot);
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
			winMan.CreateTableWindow("Score", this.score, ["name", "sender", "evaluator", "score"], new Point(map.size.width / 2, map.size.width),
				this.bots.map(bot => (style) => style.backgroundColor = bot.color.Name))
		}
		CollectMetrics() {
			return {
				"score": this.score.fields
			}
		}

		private getTexture(i: number): RectangleTexture {
			return getByModule(this.botTextures, i);
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