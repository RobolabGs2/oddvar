import { Player } from '../../oddvar/players';
import { GameLogic, MetricsSource } from '../../oddvar/manager';
import { Oddvar } from '../../oddvar/oddvar';
import { GameMap } from '../utils/game_map';
import { WallManager } from '../utils/wall_manager';
import { Point, Size } from '../../oddvar/geometry';
import { Manager, ShiftManager, SimpleVotingManager, WeightedParallelVotingManager, TimerManager, VotingManager, WeightedLengthVotingManager, WeightedRandomVotingManager } from './manager'
import { PolygonBody } from '../../oddvar/physics/body';
import { Bot, PointBot, PseudoPointBot, RandomBot, SmartPseudoPointBot } from './bot';
import { TableModel, WindowsManager } from '../../web/windows';
import { ConvertRecord, Observable } from '../../oddvar/utils';
import { BotController } from './bot_controller';
import { IsGameMap, SimulatorDescription } from '../utils/description';


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


export namespace DiscreteMonoagent {
	const managers = {
		TimerManager: "с таймингами",
		ShiftManager: "эвристика параллельности",
		SimpleVotingManager: "простая голосовалка",
		WeightedParallelVotingManager: "развесовка на основе параллельности",
		WeightedLengthVotingManager: "развесовка на основе длины",
		WeightedRandomVotingManager: "развесовка со случайными весами",
	};
	const bots = {
		PointBot: "Точка",
		RandomBot: "Рандом",
		PseudoPointBot: "Псевдоточка",
		SmartPseudoPointBot: "Умная псевдоточка",
	}
	export type Settings = {
			manager: keyof typeof managers,
			bots: Record<keyof typeof bots, number>
		}
	export const Description: SimulatorDescription<Settings, GameMap> = {
		name: "Симуляция с одним агентом на клеточках",
		NewSimulation(oddvar: Oddvar, map: GameMap, ui: WindowsManager, settings: Settings) {
			return new DiscreteMonoagentSimulation(oddvar, map, ui, settings);
		},
		IsSupportedMap: IsGameMap,
		SettingsInputType() {
			return {
				manager: { type: "enum", values: managers, default: "TimerManager"},
				bots: {type: "object", values: ConvertRecord(bots, (key, desc) => ({
					type: "int", min: 0, description: desc, default: 1
				})) }
			}
		},
	}
}


export class DiscreteMonoagentSimulation implements GameLogic, MetricsSource {
	private wallManager = new WallManager(this.oddvar);
	private bots = new Array<Bot>();
	private bot: PolygonBody;
	private size: Size;
	private botController: BotController;
	private adminTable: AdminTable;

	constructor(readonly oddvar: Oddvar, private map: GameMap, private winMan: WindowsManager, setting: DiscreteMonoagent.Settings) {
		this.size = this.map.cellSize.Scale(0.2);
		this.map.Draw(this.wallManager.creator);
		const e = oddvar.Get('World').CreateEntity('BOT POINT', this.GenerateInconflictPoint(this.size.height));
		this.bot = oddvar.Get('Physics').CreateRegularPolygonBody("BOT", e,  { lineFriction: 0.5, angleFriction: 0.1}, this.size.height, 10);
		oddvar.Get('Graphics').CreatePolygonBodyAvatar('BOT AVATAR', this.bot, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }))

		this.adminTable = new AdminTable();
		this.adminTable.add('sum');
		for (let i = 0; i < setting.bots.PointBot; ++i) {
			this.adminTable.add(`target ${i}`);
			this.createTargetBot(i, idx => {
				this.adminTable.updateScore(0);
				this.adminTable.updateScore(idx + 1);
			});
		}
		for (let i = 0; i < setting.bots.PseudoPointBot; ++i) this.bots.push(new PseudoPointBot(this.bot, map));
		for (let i = 0; i < setting.bots.RandomBot; ++i) this.bots.push(new RandomBot());
		for (let i = 0; i < setting.bots.SmartPseudoPointBot; ++i) this.bots.push(new SmartPseudoPointBot(this.bot, map, []));

		this.botController = new BotController(this.GetManager(setting), this.bot, map)

		winMan.CreateTableWindow("Score", this.adminTable, ["index", "score"], new Point(map.size.width, map.size.height / 4))
	}

	CollectMetrics() {
		return { value: this.adminTable.fields[0].score }
	}

	GetManager(setting: DiscreteMonoagent.Settings): Manager {
		switch (setting.manager) {
			case "TimerManager": return new TimerManager(this.bots, this.winMan, this.map.size, 100);
			case "SimpleVotingManager": return new SimpleVotingManager(this.bots, this.winMan, this.map.size);
			case "ShiftManager": return new ShiftManager(this.bots, this.winMan, this.map.size);
			case "WeightedParallelVotingManager": return new WeightedParallelVotingManager(this.bots, this.winMan, this.map.size);
			case "WeightedLengthVotingManager": return new WeightedLengthVotingManager(this.bots, this.winMan, this.map.size);
			case "WeightedRandomVotingManager": return new WeightedRandomVotingManager(this.bots, this.winMan, this.map.size);
		}
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
}
