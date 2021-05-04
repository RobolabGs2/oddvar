import { Manager } from "../oddvar/manager";
import { RingBuffer } from "../oddvar/utils";
import { MetricsTable, Ticker } from "../web/windows";

export class Processor {
	private _manager: Manager;
	private intervalID?: number;
	private frames = 0;
	private ticks = 0;
	private renderStart = 0;
	private ticksStart = 0;
	private ticksStatistic = new RingBuffer(60 * 2);

	public readonly metricsTable: MetricsTable;

	constructor(manager: Manager, drawTicker: Ticker[]) {
		this._manager = this.manager = manager;
		this.metricsTable = new MetricsTable(() => this.metrics);
		let lastTime = 0;
		let Render = (t: number) => {
			this.frames++;
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this._manager.DrawTick(dt);
			drawTicker.forEach(t => t.Tick(dt));
			this.metricsTable.Tick();
			requestAnimationFrame(Render);
		};

		this.play();

		requestAnimationFrame(Render);
		this.renderStart = performance.now()
	}

	public play(): void {
		if (this.intervalID !== undefined) {
			return;
		}
		let lastTime2 = this.ticksStart = performance.now();
		this.ticks = 0;
		this.intervalID = window.setInterval(() => {
			const t = performance.now();
			let dt = Math.round(t - lastTime2) / 1000;
			lastTime2 = t;
			this._manager.Tick(dt);
			this.ticksStatistic.put(performance.now() - t);
			this.ticks++;
		}, 15);
	}

	public pause(): void {
		if (this.intervalID === undefined) {
			return;
		}
		window.clearInterval(this.intervalID);
		this.intervalID = undefined;
		this.ticks = 0;
	}

	public set manager(manager: Manager) {
		this._manager = manager;
		manager.AddUser(0);
		manager.AddUser(1);
	}

	public get metrics(): Record<string, string | number | boolean> {
		const now = performance.now();
		const renderTime = (now - this.renderStart);
		const ticksTime = (now - this.ticksStart);
		const simulationTime = this._manager.oddvar.Clock.now();
		return {
			FPS: `${(this.frames * 1000 / renderTime).toFixed(2)}`,
			SPF: (this._manager.oddvar.Get("Graphics").statistic.avg / 1000).toFixed(4),
			TPS: `${(this.ticks * 1000 / ticksTime).toFixed(2)}`,
			SPT: (this.ticksStatistic.avg / 1000).toFixed(4),
			Time: `${(simulationTime / 60) | 0}:${(simulationTime % 60).toFixed(4).padStart(7, "0")}`,
		}
	}
}
