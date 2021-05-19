import { Point, Size } from "../../oddvar/geometry";
import { Dir } from "../../oddvar/labirint/labirint";
import { Logger } from "../../oddvar/utils/logger";
import { WindowsManager } from "../../web/windows";
import { Bot } from "../discrete_monoagent/bot";


export abstract class Manager
{
	constructor(protected bots: Bot[]) {
	}
	abstract Direction(): Dir;
}

export abstract class SingleBotManager extends Manager{
	protected index = 0;
	protected path = new Array<Dir>();

	protected RecalculatePath() {
		this.path = this.bots[this.index].Path()
	}

	protected PopNextPoint(): Dir {
		let result = this.path.shift();
		while (result == undefined) {
			this.RecalculatePath();
			result = this.path.shift();
		}
		return result;
	}
}

export class TimerManager extends SingleBotManager
{
	private time = 0;
	private logger: Logger;

	constructor(bots: Bot[], winMan: WindowsManager, size: Size, private switchSteps = 10) {
		super(bots);
		this.logger = winMan.CreateLoggerWindow('Events',
			new Point(size.width, size.height / 2),
			new Size(50, 30))
	}

	Direction(): Dir {
		++this.time;
		if (this.time >= this.switchSteps) {
			this.time = 0;
			this.index = (this.index + 1) % this.bots.length;
			this.logger.InfoLine(`Бот: ${this.index}; Тип: ${this.bots[this.index].typeName}`);
			this.RecalculatePath();
		}
		return this.PopNextPoint();
	}
}



interface VotingField {
	dir: Dir;
	value: number;
	bots: Array<number>;
}

export class VotingManager extends Manager
{
	private time = 0;
	private logger: Logger;
	private weights: number[];

	constructor(bots: Bot[], winMan: WindowsManager, size: Size) {
		super(bots);
		this.logger = winMan.CreateLoggerWindow('Events',
			new Point(size.width, size.height / 2),
			new Size(50, 30))
		
		this.weights = bots.map(b => 1);
	}

	PrintResult(result: VotingField[]) {
		let str = "";
		result.forEach(r => str += `${Dir[r.dir].padEnd(5)}: ${ r.value.toFixed(2).padStart(5) }      `)
		this.logger.TraceLine(str);
		this.logger.InfoLine(this.weights.map(w => w.toFixed(2).padStart(5)).toString());
	}

	Direction(): Dir {
		++this.time;
		const result: VotingField[] = [
			{ dir: Dir.DOWN, value: 0, bots: [] },
			{ dir: Dir.UP, value: 0, bots: [] },
			{ dir: Dir.LEFT, value: 0, bots: [] },
			{ dir: Dir.RIGHT, value: 0, bots: [] },
		]
		this.bots.forEach((b, i) => {
			const path = b.Path();
			if (path.length == 0) return;
			result.forEach(r => { 
				if (r.dir != path[0]) return;
				r.value += this.weights[i];
				r.bots.push(i);
			})
		})

		const winner = result.sort((v1, v2) => v2.value - v1.value)[0].dir;
		const maxBots = result.sort((v1, v2) => v2.bots.length - v1.bots.length)[0].dir;
		result.forEach(r => {
			if (r.dir == maxBots) r.bots.forEach(b => this.weights[b] *= 1.1);
			else r.bots.forEach(b => this.weights[b] *= 0.95);
		})

		for( let i = 0; i < this.weights.length; ++i) {
			if (this.weights[i] > 2) this.weights[i] = 2;
			if (this.weights[i] < 1e-4) this.weights[i] = 1e-4;
		}
		this.PrintResult(result);
		return winner;
	}
}
