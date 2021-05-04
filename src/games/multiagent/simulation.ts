import { Point } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { RectangleTexture } from '../../oddvar/textures';
import { Target } from "../utils/target";
import { WallManager } from "../utils/wall_manager";
import { GameMap } from "../utils/game_map";
import { DataMatrix, MatrixCell } from '../../oddvar/labirint/labirint';
import { Iterators } from '../../oddvar/iterator';
import { GameLogic } from '../../oddvar/manager';
import { Bot } from './bot';
import { Network } from './net';
import { Observable } from '../../oddvar/utils';
import { RotatedLogs, TableModel, WindowsManager } from '../../web/windows';
import { HTML } from '../../web/html';

const botsCount = 5;

interface BotTableLine {
	name: string;
	score: number;
}

class BotTable extends Observable<{ updated: number }> implements TableModel<BotTable, keyof BotTableLine> {
	fields: BotTableLine[] = [];
	addBot(name: string) {
		this.fields.push({ name, score: -1 });
	}
	updateScore(i: number) {
		this.fields[i].score++;
		this.dispatchEvent("updated", i);
	}
}


export class MultiagentSimulation implements GameLogic {
	bots: Bot[]
	wallManager = new WallManager(this.oddvar);
	private network: Network;
	private targetMap: DataMatrix<boolean | Map<string, Point>>
	constructor(readonly oddvar: Oddvar, private map: GameMap, winMan: WindowsManager, readonly debug = false) {
		console.log(this.map.maze.toString())


		const logHeight = 450;
		const networkLogsView = HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.maxHeight = style.height = `${logHeight}px`;
				style.width = "512px";
				style.overflow = "auto";
				style.background = "rgba(0, 0, 0, 0.9)";
				style.color = "lime";
				style.display = "flex";
				style.flexDirection = "column";
			})
		);
		const networkLogs = new RotatedLogs(() => {
			const columns = [1, 2, 3, 4].map(text => HTML.CreateElement("span", HTML.SetStyles(s => s.flex = "1")))
			const section = HTML.CreateElement("section",
				HTML.SetStyles(s => { s.display = "flex"; s.justifyContent = "space-between"; s.textAlign = "center" }),
				HTML.Append(columns));
			return { section, columns }
		}, networkLogsView, 32);

		// setInterval(() => requestAnimationFrame(() => networkLogsView.scroll(0, networkLogsView.scrollHeight)), 1000)

		const p2s = (p: Point) => `(${(p.x / 100).toFixed(2).slice(2)}, ${(p.y / 100).toFixed(2).slice(2)})`
		winMan.CreateInfoWindow("Network", networkLogsView, new Point(map.size.width, map.size.height - logHeight - 28));
		this.network = new Network(
			(msg => {
				networkLogs.insert(line => {
					const columns = line.columns;
					columns[0].textContent = `${msg.from} -> ${msg.to}`,
					columns[1].textContent = msg.type,
					columns[2].textContent = `${msg.data instanceof Point ? p2s(map.toMazeCoords(msg.data)) : msg.type}`,
					columns[3].textContent = `${msg.timestamp.toFixed(2)}`;
				})
			}), oddvar.Clock);
		const scoreTable = new BotTable();
		map.Draw(this.wallManager.creator)
		this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
		const nameOfBot = (i: number) => `Bot ${i}`
		this.bots = Iterators.Range(botsCount).
			map(i => new Bot(nameOfBot(i),
				this.oddvar, this.GenerateInconflictPoint(10, 1 << i), this.map.cellSize.Scale(3 / 7),
				this.getTexture(i), this.map, i, this.network.CreateNetworkCard(`Bot card ${i}`, nameOfBot(i)))).toArray();
		const targetSize = this.map.cellSize.Scale(1 / 5);
		const targetName = (i: number, name: string) => `target_${i} ${name}`
		const admin = this.network.CreateNetworkCard("admin card", "admin");
		this.bots.map((bot, i) => {
			scoreTable.addBot(bot.name);
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
				scoreTable.updateScore(i);
				// admin.send(new Message("admin", bot.name, "target", p.to));
			});
			target.addEventListener("collision", () => {
				const newLocation = this.GenerateInconflictPoint(targetSize.width, layers);
				target.relocate(newLocation)
			});
			target.players.set(bot.body, i);
			target.relocate(this.GenerateInconflictPoint(targetSize.width, layers));
		});
		winMan.CreateTableWindow("Score", scoreTable, ["name", "score"], new Point(map.size.width, map.size.height / 4),
			this.bots.map(bot => (style) => style.backgroundColor = bot.color.Name))
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

	AddUser() { }
	private botTextures = Iterators.Range(2).map(i => this.oddvar.Get("TexturesManager").CreateImageTexture(`bot_${0}`, `monster_${i + 1}`)).toArray();

}
