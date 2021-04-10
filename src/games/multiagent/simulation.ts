import { Point } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { RectangleTexture } from '../../oddvar/textures';
import { GameMap, Target, WallManager } from '../collecting_squares/collecting_squares';
import { DataMatrix, MatrixCell } from '../../oddvar/labirint/labirint';
import { Iterators } from '../../oddvar/iterator';
import { GameLogic } from '../../oddvar/manager';
import { Bot } from './bot';
import { Network } from './net';

const botsCount = 5;

export class MultiagentSimulation implements GameLogic {
	bots: Bot[]
	wallManager = new WallManager(this.oddvar);
	private network = new Network();
	private targetMap: DataMatrix<boolean | Map<string, Point>>
	constructor(readonly oddvar: Oddvar, private map: GameMap, readonly debug = false) {
		console.log(this.map.maze.toString())
		map.Draw(this.wallManager.creator)
		this.targetMap = map.maze.MergeOr(new DataMatrix(map.maze.width, map.maze.height, () => new Map<string, Point>()))
		const nameOfBot = (i: number) => `BOT №${i}`
		this.bots = Iterators.Range(botsCount).
			map(i => new Bot(nameOfBot(i),
				this.oddvar, this.GenerateInconflictPoint(10, 1 << i), this.map.cellSize.Scale(3 / 7),
				this.getTexture(i), this.map, i, this.network.CreateNetworkCard(`Bot card ${i}`, nameOfBot(i)))).toArray();
		const targetSize = this.map.cellSize.Scale(1 / 5);
		const targetName = (i: number, name: string) => `target_${i} ${name}`
		const admin = this.network.CreateNetworkCard("admin card", "admin");
		this.bots.forEach((bot, i) => {
			const layers = 1 << i;
			const targetPoint = oddvar.Get("World").CreateEntity(targetName(i, "entity"), this.GenerateInconflictPoint(targetSize.width, layers));
			const targetBody = oddvar.Get("Physics").CreateRectangleBody(targetName(i, "body"), targetPoint, { lineFriction: 1, angleFriction: 0.001, layers }, targetSize);
			oddvar.Get("Graphics").CreateRectangleBodyAvatar(targetName(i, "avatar"), targetBody, this.getTexture(i));
			oddvar.Get("Graphics").CreateCircleEntityAvatar(targetName(i, "avatar circle"), targetPoint, targetSize.width*0.9, bot.color);
			const target = new Target<number>(targetBody);
			target.addEventListener("relocate", (p) => {
				const old = this.map.toMazeCoords(p.from);
				const now = this.map.toMazeCoords(p.to);
				(<Map<string, Point>>this.targetMap.get(old.x, old.y)).delete(bot.name);
				(<Map<string, Point>>this.targetMap.get(now.x, now.y)).set(bot.name, p.to);
				bot.resetMap();
				// admin.send(new Message("admin", bot.name, "target", p.to));
			});
			target.addEventListener("collision", () => {
				const newLocation = this.GenerateInconflictPoint(targetSize.width, layers);
				target.relocate(newLocation)
			});
			target.players.set(bot.body, i);
			target.relocate(this.GenerateInconflictPoint(targetSize.width, layers));
		})
	}

	private getTexture(i: number): RectangleTexture {
		return this.botTextures[i % this.botTextures.length];
	}

	time = 0
	Tick(dt: number): void {
		this.time += dt;
		if (this.time > 0.5) {
			this.network.Tick(this.time);
			this.time = 0;
		}
		this.bots.forEach(bot => {
			const l = bot.botMap.toMazeCoords(bot.location);
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
