import { Point } from "../../oddvar/geometry";
import { Dir } from "../../oddvar/labirint/labirint";
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

	constructor(bots: Bot[], winMan: WindowsManager, private switchSteps = 30) {
		super(bots);
	}

	Direction(): Dir {
		++this.time;
		if (this.time >= this.switchSteps) {
			this.time = 0;
			this.index = (this.index + 1) % this.bots.length;
			this.RecalculatePath();
		}
		return this.PopNextPoint();
	}
}
