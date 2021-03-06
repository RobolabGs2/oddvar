import { Point, Size } from '../../oddvar/geometry';
import { Oddvar } from "../../oddvar/oddvar"
import { Entity } from "../../oddvar/world"
import { Player } from '../../oddvar/players';
import { PhysicControlled } from '../../oddvar/controller';
import { GameLogic } from '../../oddvar/manager';
import { IBody } from '../../oddvar/physics/body';
import { Labirint } from '../../oddvar/labirint/labirint';
import { GameMap } from '../utils/game_map';
import { Target } from '../utils/target';
import { WallCreator, WallManager } from '../utils/wall_manager';
import { MapCreator } from '../utils/description';

export const TestMap: MapCreator = (oddvar, createWall) => {
	{
		const testEntityTexture = oddvar.Get("TexturesManager").CreateColoredTexture("limestroke", ({ stroke: "lime" }));
		const e1 = oddvar.Get("World").CreateEntity("Physics test entity", new Point(100, 200));
		const b1 = oddvar.Get("Physics").CreateRectangleBody("Physics test body", e1, { lineFriction: 0, angleFriction: 0 }, new Size(10, 10))
		b1.lineVelocity.x = 10;
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("Physics test avatar", b1, testEntityTexture)
		const e2 = oddvar.Get("World").CreateEntity("Physics test entity2", new Point(200, 200), 1);
		const b2 = oddvar.Get("Physics").CreateRectangleBody("Physics test body2", e2, { lineFriction: 0, angleFriction: 0 }, new Size(10, 10))
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("Physics test avatar2", b2, testEntityTexture)
	}
	{
		const borderSize = new Size(250, 25);
		createWall(new Point(100, 100), -Math.PI / 4, borderSize);
		createWall(new Point(300, 100), Math.PI / 4, borderSize);
		createWall(new Point(100, 300), Math.PI / 4, borderSize);
		createWall(new Point(300, 300), -Math.PI / 4, borderSize, { lineFriction: 0.1, angleFriction: 0.1 });
	}
}

export class CollectingSquaresGame implements GameLogic {
	protected usersThings = new Map<number, { entity: Entity, controller: PhysicControlled, body: IBody }>();
	protected target: Target<number>;
	protected readonly size = new Size(20, 20);
	protected wallManager = new WallManager(this.oddvar);
	constructor(protected oddvar: Oddvar, mapCreator: MapCreator | GameMap, targetColor = "#009900", readonly debug = false) {
		if (mapCreator instanceof GameMap) {
			mapCreator.Draw(this.wallManager.creator);
		} else {
			mapCreator(oddvar, this.wallManager.creator);
		}
		const targetSize = new Size(10, 10);
		const targetPoint = oddvar.Get("World").CreateEntity("targetPoint", new Point(0, 0));
		const targetBody = oddvar.Get("Physics").CreateRectangleBody("targetRectangleBody", targetPoint, { lineFriction: 1, angleFriction: 0 }, targetSize);
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("targetEntityAvatar", targetBody, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: targetColor }));
		this.target = new Target<number>(targetBody);
		const game = this;
		this.target.addEventListener("collision", function (playerID) {
			game.usersThings.get(playerID)!.controller.score++;
			this.relocate(game.GenerateInconflictPoint(targetSize.width));
		})
		this.target.relocate(game.GenerateInconflictPoint(targetSize.width));
	}


	Tick(dt: number): void {
	}

	protected GenerateInconflictPoint(distance: number): Point {
		let p = new Point(Math.random() * 500, Math.random() * 500);
		if (this.oddvar.Get("Physics").Map(p) < distance)
			return this.GenerateInconflictPoint(distance);
		return p;
	}

	private textures = [
		this.oddvar.Get("TexturesManager").CreatePatternTexture("player_1", "player_1"),
		this.oddvar.Get("TexturesManager").CreatePatternTexture("player_2", "player_2"),
		this.oddvar.Get("TexturesManager").CreatePatternTexture("player_3", "player_3")
	]

	AddUser(player: Player): void {
		const name = (type: string) => `player ${player.id}: ${type}`;
		const e = this.oddvar.Get("World").CreateEntity(name("entity"), this.GenerateInconflictPoint(14));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { fill: currentColor });

		const sensor = this.oddvar.Get("World").CreateTailEntity(name("ray entity"), e, new Point(this.size.width / 2 - 1, 0));
		const ray = this.oddvar.Get("Physics").CreateRaySensor(name("ray sensor"), sensor);
		// const b = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size)
		const b = this.oddvar.Get("Physics").CreateRegularPolygonBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size.height / 2, 10)
		ray.AddToIgnore(b);
		this.oddvar.Get("Graphics").CreatePolygonBodyAvatar(name("body avatar"), b, texture)//this.textures[player.id % this.textures.length]);

		const c = this.oddvar.Get("Controller").CreatePhysicControlled(name("controller"), b, player);
		this.oddvar.Get("Graphics").CreatePhysicControlledAvatar(name("controller avatar"), c, currentColor)
		this.usersThings.set(player.id, { entity: e, controller: c, body: b });

		this.target.players.set(b, player.id);
		player.DeathSubscribe(p => {
			e.Die();
			this.usersThings.delete(player.id);
			this.target.players.delete(b);
		})
	}
}

const PacManQ: (0 | 1)[][] = [
	[0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
	[1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	[1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
	[0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
	[0, 0, 0, 1, 1, 1, 1, 1, 1, 0],
	[0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
	[1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
	[0, 0, 0, 1, 1, 1, 0, 1, 1, 1],
]

export const BigPacManMap = Labirint.SymmetryOdd(PacManQ, "XY", 2).Frame();
export const PacManMap = Labirint.SymmetryOdd(PacManQ).Frame();
export const RandomMap = Labirint.Generate(50, 50).Or(Labirint.Frame(50, 50, 3));

function drawMaze(maze: Labirint, canvasWidth: number, canvasHeight: number, createWall: WallCreator) {
	maze.Draw(new Size(canvasWidth / maze.width, canvasHeight / maze.height), new Point(0, 0), createWall)
}

export const PacManLikeLabirint: MapCreator = (oddvar, createWall) => drawMaze(PacManMap, 500, 500, createWall);

export const RandomLabirint: MapCreator = (oddvar, createWall) => {
	RandomMap.Draw(new Size(10, 10), new Point(0, 0), createWall)
}

