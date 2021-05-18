import { Player } from '../../oddvar/players';
import { GameLogic } from '../../oddvar/manager';
import { Oddvar } from '../../oddvar/oddvar';
import { GameMap } from '../utils/game_map';
import { WallManager } from '../utils/wall_manager';
import { Point, Size } from '../../oddvar/geometry';
import { Manager, TimerManager } from './manager'
import { IBody, PolygonBody } from '../../oddvar/physics/body';
import { Bot, PointBot, RandomBot } from './bot';
import { BarChartRow, BarChartWindow, ChartWindow, TableModel, WindowsManager } from '../../web/windows';
import { Observable } from '../../oddvar/utils';
import { BotController } from './bot_controller';


interface TableLine {
	index: string;
	score: number;
}

class AdminTable extends Observable<{ updated: number }> implements TableModel<AdminTable, keyof TableLine> {
	fields: TableLine[] = [];
	add(idx: string) {
		this.fields.push({ index: idx, score: 0 });
	}

	updateScore(i: number) {
		this.fields[i].score++;
		this.dispatchEvent("updated", i);
	}
}

export class DiscreteMonoagentSimulation implements GameLogic {
	private wallManager = new WallManager(this.oddvar);
	private bots = new Array<Bot>();
	private bot: PolygonBody;
	private size: Size;
	private botController: BotController;

	constructor(readonly oddvar: Oddvar, private map: GameMap, winMan: WindowsManager, readonly debug = false) {
		this.size = this.map.cellSize.Scale(0.2);
		this.map.Draw(this.wallManager.creator);
		const e = oddvar.Get('World').CreateEntity('BOT POINT', this.GenerateInconflictPoint(this.size.height));
		this.bot = oddvar.Get('Physics').CreateRegularPolygonBody("BOT", e,  { lineFriction: 0.1, angleFriction: 0.1}, this.size.height, 10);
		oddvar.Get('Graphics').CreatePolygonBodyAvatar('BOT AVATAR', this.bot, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }))

		const adminTable = new AdminTable();
		adminTable.add('sum');
		for (let i = 0; i < 3; ++i) {
			adminTable.add(`target ${i}`);
			this.createTargetBot(i, idx => {
				adminTable.updateScore(0);
				adminTable.updateScore(idx + 1);
			});
		}
		this.bots.push(new RandomBot());

		const manager = new TimerManager(this.bots, winMan);
		this.botController = new BotController(manager, this.bot, map)

		winMan.CreateTableWindow("Score", adminTable, ["index", "score"], new Point(map.size.width, map.size.height / 4))
	}

	Tick(dt: number): void {
		this.botController.Tick(dt);
	}

	protected GenerateInconflictPoint(distance: number): Point {
		const p = new Point((Math.random() * this.map.maze.width) | 0, (Math.random() * this.map.maze.height) | 0);
		const result = this.map.fromMazeCoords(p);
		if (this.map.maze.get(p.x, p.y) || this.oddvar.Get("Physics").Map(result) < distance)
			return this.GenerateInconflictPoint(distance);
		return result;
	}

	createTargetBot(idx: number, hitAction?: ((idx: number) => void)): PointBot {
		const target = this.oddvar.Get('World').CreateEntity(`bot target ${idx}`, this.GenerateInconflictPoint(this.size.width));
		const body = this.oddvar.Get('Physics').CreateRectangleBody(`bot target ${idx} body`, target, { static: false, lineFriction: 1 }, this.size);
		this.oddvar.Get('Graphics').CreateRectangleBodyAvatar(`bot target ${idx} avatar`, body, this.oddvar.Get('TexturesManager').CreateColoredTexture('asdasdfafsd', { fill: 'grb(1,150,1)' }));
		const bot = new PointBot(this.bot, this.map, target);
		this.bots.push(bot);

		body.AddCollisionListener((_, b) => {
			if (b == this.bot) {
				target.location = this.GenerateInconflictPoint(this.size.width);
				hitAction?.(idx);
			}
		});
		return bot;
	}

	AddUser(player: Player): void { }
}
