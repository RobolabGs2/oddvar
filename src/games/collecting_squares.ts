import { Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { Entity } from "../oddvar/world"
import { Player } from '../oddvar/players';
import { PhysicControlled } from '../oddvar/controller';
import { GameLogic } from '../oddvar/manager';
import { Body, IBody, PhysicalMaterial, RectangleBody } from '../oddvar/physics/body';
import { Labirint } from './labirint';
import { Observable } from '../oddvar/utils';
import { RectangleTexture } from '../oddvar/textures';


export type WallCreator = (center: Point, rotation: number, size: Size, material?: Partial<PhysicalMaterial>) => void;

export type MapCreator = (oddvar: Oddvar, createWall: WallCreator) => void;

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

export const RandomLabirint: MapCreator = (oddvar, createWall) => Labirint.Generate(50, 50).Or(Labirint.Frame(50, 50, 3)).Draw(new Size(10, 10), new Point(0, 0), createWall)


function RandomElem<T>(elems: T[]): T {
	return elems[(Math.random() * elems.length) | 0];
}


export interface TargetEvents<Player> {
	relocate: Point;
	collision: Player;
}

export class Target<Player> extends Observable<TargetEvents<Player>> {
	readonly players = new Map<Body, Player>();
	constructor(readonly body: Body) {
		super();
		body.AddCollisionListener((self, another) => {
			const player = this.players.get(another);
			if (player !== undefined)
				this.dispatchEvent("collision", player)
		})
	}

	relocate(to: Point) {
		this.dispatchEvent("relocate", this.body.entity.location = to);
	}
}

export class WallManager {
	constructor(readonly oddvar: Oddvar, textureName = "bricks", readonly debug = false) {
		this.borderTexture = this.oddvar.Get("TexturesManager").CreatePatternTexture("wall", textureName);
	}
	private wallCounter = 0;
	private borderTexture: RectangleTexture;
	private borderTextureDebug = this.oddvar.Get("TexturesManager").CreateColoredTexture("debug", { stroke: "red" });
	public newWall(center: Point, rotation: number, size: Size, material: Partial<PhysicalMaterial> = { static: true, lineFriction: 0.1, angleFriction: 0.1 }) {
		const id = this.wallCounter++;
		const border = this.oddvar.Get("World").CreateEntity(`wall ${id}`, center, rotation);
		const body = this.oddvar.Get("Physics").CreateRectangleBody(`wall ${id} body`, border, material, size)
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar`, body, this.borderTexture)
		if (this.debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(`wall ${id} avatar debug`, body, this.borderTextureDebug)
	}
	
	public get creator() : WallCreator {
		return this.newWall.bind(this);
	}
	
}

export class CollectingSquaresGame implements GameLogic {
	protected usersThings = new Map<number, { entity: Entity, controller: PhysicControlled, body: IBody }>();
	protected target: Target<number>;
	protected readonly size = new Size(20, 20);
	protected wallManager = new WallManager(this.oddvar);
	constructor(protected oddvar: Oddvar, mapCreator: MapCreator | GameMap, readonly debug = false) {
		if (mapCreator instanceof GameMap) {
			mapCreator.Draw(this.wallManager.creator);
		} else {
			mapCreator(oddvar, this.wallManager.creator);
		}
		const targetSize = new Size(10, 10);
		const targetPoint = oddvar.Get("World").CreateEntity("targetPoint", new Point(0, 0));
		const targetBody = oddvar.Get("Physics").CreateRectangleBody("targetRectangleBody", targetPoint, { lineFriction: 1, angleFriction: 0 }, targetSize);
		oddvar.Get("Graphics").CreateRectangleBodyAvatar("targetEntityAvatar", targetBody, this.oddvar.Get("TexturesManager").CreateColoredTexture("greenfill", { fill: "green" }));
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
		this.oddvar.Get("TexturesManager").CreateImageTexture("player_1", "player_1"),
		this.oddvar.Get("TexturesManager").CreateImageTexture("player_2", "player_2"),
		this.oddvar.Get("TexturesManager").CreateImageTexture("player_3", "player_3")
	]

	AddUser(player: Player): void {
		const name = (type: string) => `player ${player.id}: ${type}`;
		const e = this.oddvar.Get("World").CreateEntity(name("entity"), this.GenerateInconflictPoint(14));
		const currentColor = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture(currentColor, { stroke: currentColor, fill: "white" });

		const sensor = this.oddvar.Get("World").CreateTailEntity(name("ray entity"), e, new Point(this.size.width / 2 - 1, 0));
		const ray = this.oddvar.Get("Physics").CreateRaySensor(name("ray sensor"), sensor);
		// const b = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size)
		const b = this.oddvar.Get("Physics").CreateRegularPolygonBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size.height / 2, 8)
		ray.AddToIgnore(b);
		// if (this.debug) {
		// 	this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body debug avatar"), b, texture);
		// 	this.oddvar.Get("Graphics").CreateRaySensorAvatar(name("ray avatar"), ray, texture);
		// }
		// this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body avatar"), b, this.textures[player.id % this.textures.length]);
		this.oddvar.Get("Graphics").CreateRegularPolygonBodyAvatar(name("body avatar"), b, this.textures[player.id % this.textures.length]);

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

export class GameMap {
	constructor(
		readonly maze: Labirint,
		readonly size: Size = new Size(500, 500)
	) {
		this.cellSize = new Size(size.width / maze.width, size.height / maze.height)
	}
	readonly cellSize: Readonly<Size>;

	Draw(createWall: WallCreator) {
		this.maze.Draw(this.cellSize, Point.Zero, createWall);
	}
}

export const PacManBig = Labirint.SymmetryOdd(Labirint.SymmetryOdd(PacManQ)).Frame();
export const PacMan = Labirint.SymmetryOdd(PacManQ).Frame();

function drawMaze(maze: Labirint, canvasWidth: number, canvasHeight: number, createWall: WallCreator) {
	maze.Draw(new Size(canvasWidth / maze.width, canvasHeight / maze.height), new Point(0, 0), createWall)
}

export const PacManLikeLabirint: MapCreator = (oddvar, createWall) => drawMaze(PacMan, 500, 500, createWall);
