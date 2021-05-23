import { MapType, SimulatorDescription } from "../games/utils/description";
import { Iterators } from "../oddvar/iterator";
import { Manager } from "../oddvar/manager";
import { Observable, RingBuffer } from "../oddvar/utils";
import { HTML } from "../web/html";
import { MetricsTable, Ticker } from "../web/windows";

export class SimulationLaunch<T extends object = object> {
	constructor(
		readonly simulationID: string,
		readonly simulator: SimulatorDescription<T, MapType>,
		readonly settings: T,
		readonly mapID: string,
		readonly deadline: number,
	) { }
	copy(): SimulationLaunch<T> {
		return new SimulationLaunch(this.simulationID, this.simulator, JSON.parse(JSON.stringify(this.settings)), this.mapID, this.deadline);
	}
	copyN(n: number): SimulationLaunch<T>[] {
		return Iterators.Range(n).map(x=>this.copy()).toArray();
	}
}

export type ProcessorState = {
	manager: Manager,
	metrics: typeof Processor.prototype.processorMetrics
	launch: SimulationLaunch
}
export type ProcessorSimulationFinished = ProcessorState & {
	reason: "deadline"
}

export type ProcessorSettings = {
	/** максимальное количество кадров в секунду */
	FPS: number,
	/** максимальное количество тиков в секунду */
	TPS: number,
	/** 0: в реальном времени */
	dt: number
}

export const ProcessorSettingsInput = {
	type: "object" as "object", values: {
		FPS: {
			description: "Максимальное количество кадров в секунду",
			type: "float", default: 60, min: 0.1, max: 60
		},
		TPS: {
			description: "Максимальное количество тиков в секунду",
			type: "float", default: 66.6, min: 0.1
		},
		dt: {
			description: "Сколько времени проходит в симуляции за один тик, 0 - в реальном времени",
			type: "float", default: 0, min: 0, max: Manager.MaxDTPerTick
		},
	} as Record<keyof ProcessorSettings, HTML.Input.Type>
}

export class Processor extends Observable<{
	finished: ProcessorSimulationFinished
}, Processor>{
	private _manager?: Manager;
	private intervalTicksID?: number;
	private intervalRenderID?: number;
	private frames = 0;
	private ticks = 0;
	private renderStart = 0;
	private ticksStart = 0;
	private ticksStatistic = new RingBuffer(60 * 2);
	private dtStatistic = new RingBuffer(60 * 2);
	private realTime = 0;
	public readonly metricsTable: MetricsTable;

	private _settings = HTML.Input.GetDefault(ProcessorSettingsInput) as ProcessorSettings;
	public set settings(settings: ProcessorSettings) {
		this._settings = settings;
		this.render();
		if (this.isPlaying()) {
			this.pause();
			this.play();
		}
	}

	constructor(readonly drawTicker: Ticker[]) {
		super();
		this.metricsTable = new MetricsTable(() => {
			const metrics = this.processorMetrics;
			return {
				FPS: metrics.FPS.toFixed(2),
				SPF: metrics.SPF.toFixed(4),
				TPS: metrics.TPS.toFixed(2),
				SPT: metrics.SPT.toFixed(4),
				dt: metrics.dt.toFixed(4),
				Time: renderSeconds(metrics.Time),
				Realtime: renderSeconds(metrics.Realtime),
				Speed: (metrics.Time / metrics.Realtime).toFixed(2),
			}
		});
		this.render();
	}
	private launch?: SimulationLaunch;
	/**
	 * 
	 * @param manager 
	 * @param deadline время, после которого требуется завершить симуляцию, в секундах (0 - нет дедлайна)
	 */
	public launchNewSimulation(manager: Manager, settings: SimulationLaunch) {
		this._manager = manager;
		if (manager?.HasPlayers()) {
			manager.AddUser(0);
			manager.AddUser(1);
		}
		this.launch = settings;
		this.realTime = 0;
		this.play();
	}

	private render(): void {
		if (this.isRendering()) {
			clearInterval(this.intervalRenderID);
			this.intervalRenderID = 0;
		}
		let lastRenderTime = this.renderStart = performance.now();
		this.frames = 0;
		let Render = (t: number) => {
			this.frames++;
			let dt = (t - lastRenderTime) / 1000;
			lastRenderTime = t;
			this._manager?.DrawTick(dt);
			this.drawTicker.forEach(t => t.Tick(dt));
			this.metricsTable.Tick();
		};
		this.intervalRenderID = window.setInterval(requestAnimationFrame, 1000 / this._settings.FPS, Render);
	}

	public play(): void {
		if (this.isPlaying() || this._manager === undefined) {
			return;
		}
		let lastTickTime = this.ticksStart = performance.now();
		this.ticks = 0;
		this.intervalTicksID = window.setInterval(() => {
			if (!this._manager) {
				this.pause()
				return;
			}
			const t = performance.now();
			let dt = Math.round(t - lastTickTime) / 1000;
			lastTickTime = t;
			this.realTime += dt;
			this.dtStatistic.put(dt);
			this._manager.Tick(this._settings.dt === 0 ? dt : this._settings.dt);
			this.ticksStatistic.put(performance.now() - t);
			this.ticks++;
			if (this.launch!.deadline > 0 && this._manager.oddvar.Clock.now() >= this.launch!.deadline) {
				const event = this.state() as ProcessorSimulationFinished;
				event.reason = "deadline";
				this._manager = undefined;
				this.launch = undefined;
				this.dispatchEvent("finished", event);
			}
		}, 1000 / this._settings.TPS);
	}

	public state(): ProcessorState {
		return { manager: this._manager!, launch: this.launch!, metrics: this.processorMetrics }
	}

	public pause(): void {
		if (!this.isPlaying()) {
			return;
		}
		window.clearInterval(this.intervalTicksID);
		this.intervalTicksID = undefined;
		this.ticks = 0;
	}

	public isPlaying(): boolean {
		return this.intervalTicksID !== undefined;
	}

	public isRendering(): boolean {
		return this.intervalRenderID !== undefined;
	}

	public get manager(): Manager | undefined {
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
			dt: this.dtStatistic.avg,
			Time: simulationTime,
			Realtime: this.realTime,
		}
	}
}
function renderSeconds(seconds: number): string | number | boolean {
	return `${(seconds / 60) | 0}:${(seconds % 60).toFixed(4).padStart(7, "0")}`;
}

