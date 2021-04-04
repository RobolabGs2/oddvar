import { Matrix, Point, Size } from '../oddvar/geometry';
import { Oddvar } from "../oddvar/oddvar"
import { TailEntity } from "../oddvar/world"
import { RectangleBody } from '../oddvar/physics/body';
import { ColoredTexture, RectangleTexture } from '../oddvar/textures';
import { RaySensor } from '../oddvar/physics/sensor';
import { CollectingSquaresGame, MapCreator, RandomLabirint } from './collecting_squares';


export class MultiagentSimulation extends CollectingSquaresGame {
	constructor(oddvar: Oddvar, mapCreator: MapCreator = RandomLabirint, readonly debug = false) {
		super(oddvar, mapCreator, debug)
		this.bot = new Bot(this.oddvar, this.GenerateInconflictPoint(14), this.size, this.botTexture);
	}

	bot: Bot;
	Tick(dt: number): void {
		this.bot.Tick(dt);
	}

	private botTexture = this.oddvar.Get("TexturesManager").CreateImageTexture("monster", "monster_1");

}

type BotSensor = {
	entity: TailEntity,
	ray: RaySensor
}

type BotSensors = {
	Center: BotSensor
	Left: BotSensor
	Right: BotSensor
}

type Settings<T> = { [K in keyof T]: number }
type SensorsSettings = Settings<BotSensors>


class Bot {
	body: RectangleBody
	sensors: BotSensors
	sensorsBinding: TailEntity
	program: Generator<BotCommand<"move"> | BotCommand<"turn">, void, boolean>;
	lastCommand: IteratorResult<BotCommand<"move"> | BotCommand<"turn">, void>;
	constructor(readonly oddvar: Oddvar, place: Point, readonly size: Size, botTexture: RectangleTexture, debug = false) {
		const name = (type: string) => `bot: ${type}`;
		const sensorsSettings: SensorsSettings = {
			Center: 0,
			Left: -Math.PI / 3,
			Right: Math.PI / 3,
		}

		const e = this.oddvar.Get("World").CreateEntity(name("entity"), place);
		const texture = this.oddvar.Get("TexturesManager").CreateColoredTexture("bot", { stroke: "red", fill: "red" });
		this.sensorsBinding = this.oddvar.Get("World").CreateTailEntity(name("ray entity"), e, new Point(this.size.width / 2 - 1, 0));
		this.body = this.oddvar.Get("Physics").CreateRectangleBody(name("body"), e, { lineFriction: 0.1, angleFriction: 0.1 }, this.size);
		this.sensors = Object.fromEntries(Object.entries(sensorsSettings).map(([key, rotation]) => [key, this.makeSensor((x) => name(`${key} ray ${x}`), texture, rotation, debug)])) as BotSensors;
		if (debug) this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body debug avatar"), this.body, texture);
		this.oddvar.Get("Graphics").CreateRectangleBodyAvatar(name("body avatar"), this.body, botTexture);

		this.prevState = {
			location: place.Clone(),
			rotation: 0
		}
		this.program = BotProgram(this.sensors);
		this.lastCommand = this.program.next()
	}

	private makeSensor(name: (type: string) => string, texture: ColoredTexture, rotation: number, debug: boolean): BotSensor {
		const entity = this.oddvar.Get("World").CreateTailEntity(name(`entity`), this.sensorsBinding, new Point(0, 0), rotation)
		const ray = this.oddvar.Get("Physics").CreateRaySensor(name(`sensor`), entity);
		ray.AddToIgnore(this.body);
		if (debug) this.oddvar.Get("Graphics").CreateRaySensorAvatar(name(`avatar`), ray, texture);
		return { entity, ray };
	}

	Move(direction: "forward" | "backward") {
		this.body.Kick(new Point(90000, 0).Transform(Matrix.Rotation(this.body.entity.rotation - (direction == "backward" ? Math.PI : 0))))
	}


	Turn(direction: "right" | "left") {
		this.body.TurnKick((direction == "left" ? -1 : 1) * 300000)
	}

	time: number = 0
	prevState: { location: Point, rotation: number }
	updateState() {
		this.prevState.location = this.body.entity.location.Clone();
		this.prevState.rotation = this.body.entity.rotation;
		this.time = 0;
	}
	Tick(dt: number) {
		this.time += dt;
		const command = this.lastCommand.value;
		if (command == undefined)
			throw new TypeError(`Command is undefined!`)
		if (this.time > command.timeout) {
			this.updateState();
			this.lastCommand = this.program.next(false);
			this.Tick(0);
		}
		switch (command.command) {
			case "move":
				const coveredDistance = this.prevState.location.Dist(this.body.entity.location);
				if (command.arguments.distance <= coveredDistance) {
					this.updateState();
					this.lastCommand = this.program.next(true);
					break;
				}
				// if (command.arguments.direction == "forward" && command.arguments.distance - coveredDistance > this.sensors.Center.ray.distance) {
					// this.updateState();
					// this.lastCommand = this.program.next(false);
					// break;
				// }
				this.Move(command.arguments.direction);
				break;
			case "turn":
				if (command.arguments.angle <= this.prevState.rotation - this.body.entity.rotation) {
					this.updateState();
					this.lastCommand = this.program.next(true);
					break;
				}
				this.Turn(command.arguments.direction);
				break;
		}
	}
}

interface BotCommandsMap {
	move: {
		direction: "forward" | "backward"
		distance: number
	}
	turn: {
		direction: "left" | "right"
		angle: number
	}
}

type BotCommand<T extends keyof BotCommandsMap> = {
	command: T
	arguments: BotCommandsMap[T]
	timeout: number
}

function* BotProgram(sensors: BotSensors): Generator<BotCommand<"move"> | BotCommand<"turn">, void, boolean> {
	while (true) {
		const forwardSpace = sensors.Center.ray.distance;
		if (forwardSpace > 5) {
			let forward = yield {
				command: "move",
				timeout: 1.5,
				arguments: {
					direction: "forward",
					distance: forwardSpace,
				}
			};
			continue;
		}

		let rotateLeft = yield {
			command: "turn",
			timeout: 3,
			arguments: {
				direction: "left",
				angle: Math.PI / 4,
			}
		}
		if (rotateLeft)
			continue;
		let rotateRight = yield {
			command: "turn",
			timeout: 3,
			arguments: {
				direction: "right",
				angle: Math.PI / 4,
			}
		}
		if (rotateRight)
			continue;
		yield {
			command: "move",
			timeout: 2,
			arguments: {
				direction: "backward",
				distance: 40,
			}
		}
	}
}
