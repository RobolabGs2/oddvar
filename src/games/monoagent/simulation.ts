import { Player } from '../../oddvar/players';
import { GameLogic } from '../../oddvar/manager';
import { Oddvar } from '../../oddvar/oddvar';
import { GameMap } from '../utils/game_map';
import { WallManager } from '../utils/wall_manager';
import { Point, Size } from '../../oddvar/geometry';
import { Administrator, RandomAdministrator } from './administrators'
import { PolygonBody } from '../../oddvar/physics/body';


export class MonoagentSimulation implements GameLogic {
	private wallManager = new WallManager(this.oddvar);
	private administrators = new Array<Administrator>();
	private bot: PolygonBody;
	private size: Size;

	constructor(readonly oddvar: Oddvar, private map: GameMap, readonly debug = false) {
		this.size = this.map.cellSize.Scale(0.2);
		this.map.Draw(this.wallManager.creator);
		const e = oddvar.Get('World').CreateEntity('BOT POINT', this.GenerateInconflictPoint(this.size.height));
		this.bot = oddvar.Get('Physics').CreateRegularPolygonBody("BOT", e,  { lineFriction: 0.1, angleFriction: 0.1}, this.size.height, 10);
		oddvar.Get('Graphics').CreatePolygonBodyAvatar('BOT AVATAR', this.bot, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }))

		this.administrators.push(new RandomAdministrator());
	}

	Tick(dt: number): void {
		for (let i = 0; i < this.administrators.length; ++i) {
			this.bot.Kick(this.administrators[i].Work().Norm().Mult(1000000));
		}
	}

	protected GenerateInconflictPoint(distance: number): Point {
		let p = new Point(Math.random() * 500, Math.random() * 500);
		if (this.oddvar.Get("Physics").Map(p) < distance)
			return this.GenerateInconflictPoint(distance);
		return p;
	}

	AddUser(player: Player): void { }
}
