import { Player } from '../../oddvar/players';
import { GameLogic } from '../../oddvar/manager';
import { Oddvar } from '../../oddvar/oddvar';
import { GameMap } from '../utils/game_map';
import { WallManager } from '../utils/wall_manager';
import { Point, Size } from '../../oddvar/geometry';
import { Administrator, PointAdministrator, RandomAdministrator } from './administrators'
import { IBody, PolygonBody } from '../../oddvar/physics/body';
import { DemocraticUnity, DictaturaUnity, SmartUnity, TimerUnity, Unity, WeightedUnity } from './unity';
import { BarChartRow, BarChartWindow, ChartWindow, Logger, TableModel, WindowsManager } from '../../web/windows';
import { Observable } from '../../oddvar/utils';
import { HTML } from '../../web/html';


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

export class MonoagentSimulation implements GameLogic {
	private wallManager = new WallManager(this.oddvar);
	private administrators = new Array<Administrator>();
	private bot: PolygonBody;
	private size: Size;
	private unity: Unity;

	constructor(readonly oddvar: Oddvar, private map: GameMap, winMan: WindowsManager, readonly debug = false) {
		this.size = this.map.cellSize.Scale(0.2);
		this.map.Draw(this.wallManager.creator);
		const e = oddvar.Get('World').CreateEntity('BOT POINT', this.GenerateInconflictPoint(this.size.height));
		this.bot = oddvar.Get('Physics').CreateRegularPolygonBody("BOT", e,  { lineFriction: 0.1, angleFriction: 0.1}, this.size.height, 10);
		oddvar.Get('Graphics').CreatePolygonBodyAvatar('BOT AVATAR', this.bot, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }))

		const adminTable = new AdminTable();
		adminTable.add('sum');
		for (let i = 0; i < 5; ++i) {
			adminTable.add(`target ${i}`);
			this.createTargetAdministrator(i, idx => {
				adminTable.updateScore(0);
				adminTable.updateScore(idx + 1);
			});
		}
		this.administrators.push(new RandomAdministrator());

		// this.unity = new TimerUnity(this.administrators);
		// this.unity = new DemocraticUnity(this.administrators);
		// this.unity = new DictaturaUnity(this.administrators);
		// this.unity = new SmartUnity(this.administrators);
		this.unity = new WeightedUnity(this.administrators, winMan, map.size, 2);
		
		winMan.CreateTableWindow("Score", adminTable, ["index", "score"], new Point(map.size.width, map.size.height / 4))
	}

	Tick(dt: number): void {
		const direction = this.unity.Work(dt);
		if (direction.Len() < 1e-10) {
			return;
		}
		this.bot.Kick(direction.Norm().Mult((this.bot as IBody).Mass() * 500))
	}

	protected GenerateInconflictPoint(distance: number): Point {
		const p = new Point((Math.random() * this.map.maze.width) | 0, (Math.random() * this.map.maze.height) | 0);
		const result = this.map.fromMazeCoords(p);
		if (this.map.maze.get(p.x, p.y) || this.oddvar.Get("Physics").Map(result) < distance)
			return this.GenerateInconflictPoint(distance);
		return result;
	}

	createTargetAdministrator(idx: number, hitAction?: ((idx: number) => void)): PointAdministrator {
		const target = this.oddvar.Get('World').CreateEntity(`admin target ${idx}`, this.GenerateInconflictPoint(this.size.width));
		const body = this.oddvar.Get('Physics').CreateRectangleBody(`admin target ${idx} body`, target, { static: false, lineFriction: 1 }, this.size);
		this.oddvar.Get('Graphics').CreateRectangleBodyAvatar(`admin target ${idx} avatar`, body, this.oddvar.Get('TexturesManager').CreateColoredTexture('asdasdfafsd', { fill: 'grb(1,150,1)' }));
		const admin = new PointAdministrator(this.bot, this.map, target);
		this.administrators.push(admin);

		body.AddCollisionListener((_, b) => {
			if (b == this.bot) {
				target.location = this.GenerateInconflictPoint(this.size.width);
				admin.updatePath();
				admin.SetEndwork();
				if (hitAction) hitAction(idx);
			}
		});
		return admin;
	}

	AddUser(player: Player): void { }
}
