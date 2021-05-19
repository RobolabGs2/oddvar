import { Manager } from "../oddvar/manager";
import { RingBuffer } from "../oddvar/utils";
import { MetricsTable, Ticker } from "../web/windows";

export class Processor {
	private _manager?: Manager;
	private intervalID?: number;
	private frames = 0;
	private ticks = 0;
	private renderStart = 0;
	private ticksStart = 0;
	private ticksStatistic = new RingBuffer(60 * 2);

	public readonly metricsTable: MetricsTable;

	constructor(drawTicker: Ticker[]) {
		this.metricsTable = new MetricsTable(() => {
			const metrics = this.processorMetrics;
			return {
				FPS: metrics.FPS.toFixed(2),
				SPF: metrics.SPF.toFixed(4),
				TPS: metrics.TPS.toFixed(2),
				SPT: metrics.SPT.toFixed(4),
				Time: `${(metrics.Time / 60) | 0}:${(metrics.Time % 60).toFixed(4).padStart(7, "0")}`,
			}
		});
		let lastTime = 0;
		let Render = (t: number) => {
			this.frames++;
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			this._manager?.DrawTick(dt);
			drawTicker.forEach(t => t.Tick(dt));
			this.metricsTable.Tick();
			requestAnimationFrame(Render);
		};

		this.play();

		requestAnimationFrame(Render);
		this.renderStart = performance.now()
	}

	public play(): void {
		if (this.isPlaying()) {
			return;
		}
		let lastTickTime = this.ticksStart = performance.now();
		this.ticks = 0;
		this.intervalID = window.setInterval(() => {
			const t = performance.now();
			let dt = Math.round(t - lastTickTime) / 1000;
			lastTickTime = t;
			this._manager?.Tick(dt);
			this.ticksStatistic.put(performance.now() - t);
			this.ticks++;
		}, 15);
	}

	public pause(): void {
		if (!this.isPlaying()) {
			return;
		}
		window.clearInterval(this.intervalID);
		this.intervalID = undefined;
		this.ticks = 0;
	}

	public isPlaying(): boolean {
		return this.intervalID !== undefined;
	}

	public set manager(manager: Manager|undefined) {
		this._manager = manager;
		if (manager?.HasPlayers()) {
			manager.AddUser(0);
			manager.AddUser(1);
		}
	}

	public get manager(): Manager|undefined {
		return this._manager;
	}

	public get processorMetrics() {
		const now = performance.now();
		const renderTime = (now - this.renderStart);
		const ticksTime = (now - this.ticksStart);
		const simulationTime = this._manager?.oddvar.Clock.now() || 0;
		return {
			FPS: this.frames * 1000 / renderTime,
			SPF: (this._manager?.oddvar.Get("Graphics").statistic.avg || 0) / 1000,
			TPS: this.ticks * 1000 / ticksTime,
			SPT: this.ticksStatistic.avg / 1000,
			Time: simulationTime,
		}
	}
}
