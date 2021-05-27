import { Processor, renderSeconds, SimulationLaunch } from "./processor";
import { HTML } from "../web/html";
import { downloadAsFile, ReadJSONsFromUserFiles } from "../web/http";
import { WindowsManager } from "../web/windows";
import { Iterators } from "../oddvar/iterator";

export function CreateQueueOfLaunches(processor: Processor, LaunchSimulation: (settings: SimulationLaunch) => boolean, FlatMapArraysOfRawSimulationLaunch: (x: any[]) => Promise<SimulationLaunch<object>[]>, mainWindowsManager: WindowsManager) {
	return {
		queue: new Array<SimulationLaunch>(),
		enqueue(launch: SimulationLaunch) { this.queue.push(launch); this.updateView(); },
		html: HTML.CreateElement("div", HTML.SetStyles(s => s.height = "16px")),
		updateView() {
			const timeEstimated = this.queue.map(x => x.deadline || Infinity).reduce((x, y) => x + y, 0) / (processor.processorMetrics.Speed || 1);
			this.html.innerText = `В очереди: ${this.queue.length}, примерно времени: ${renderSeconds(timeEstimated, false)}`;
		},
		Tick() {
			this.updateView();
		},
		dequeue() {
			if (this.empty())
				throw new Error(`Dequeue on empty queue`);
			const item = this.queue.shift()!;
			this.updateView();
			return item;
		},
		empty() { return this.queue.length === 0; },
		play() {
			if (this.empty())
				return false;
			LaunchSimulation(this.dequeue());
			return true;
		},
		buttonPlayFromQueue() { this.play(); },
		buttonCleanQueue() { this.queue.length = 0; this.updateView(); },
		buttonSaveToFile() {
			downloadAsFile(`oddvar_queue_${this.queue.length}_items`, this.queue);
		},
		buttonLoadFromFiles() {
			ReadJSONsFromUserFiles().then(FlatMapArraysOfRawSimulationLaunch).then(queue => {
				this.queue = queue;
				this.updateView();
			}).catch(alert);
		},
		buttonAppendFromFiles() {
			ReadJSONsFromUserFiles().then(FlatMapArraysOfRawSimulationLaunch).then(queue => {
				this.queue.push(...queue);
				this.updateView();
			}).catch(alert);
		},
		buttonSplitToFiles() {
			let closeable = { close() { } }
			const input = HTML.Input.CreateForm<DivideSettings>(DivideFileSettings, {
				Save: (settings) => {
					const partsCount = Math.min(settings.parts, this.queue.length);
					const inOnePart = (this.queue.length / partsCount) | 0;
					const parts = Iterators.Range(partsCount).
						map(i => this.queue.slice(i * inOnePart, i + 1 === partsCount ? undefined : (i + 1) * inOnePart)).toArray();
					parts.forEach((part, i) => {
						downloadAsFile(`${settings.filename}(${i + 1}_${partsCount})`, part);
					});
					switch (settings.modifyQueue) {
						case "clean":
							this.queue = [];
							break
						case "save_first":
							this.queue = parts[0];
							break;
					}
					this.updateView();
					closeable.close();
				}
			}, undefined);
			closeable = mainWindowsManager.CreateCloseableWindow("Hello", input);
		}
	};
}

type QueueModifications = "none" | "clean" | "save_first";
type DivideSettings = {
	parts: number;
	modifyQueue: QueueModifications;
	filename: string;
}
const DivideFileSettings: HTML.Input.ObjectType<keyof DivideSettings> = {
	type: "object", values: {
		modifyQueue: {
			type: "enum", values: {
				"none": "Не менять",
				"clean": "Очистить",
				"save_first": "Оставить первую часть",
			}, default: "none",
			description: "Что сделать с очередью в текущей вкладке"
		},
		parts: { type: "int", min: 1, default: 2, description: "На сколько частей разбить очередь" },
		filename: { type: "string", default: "queue", description: "Имена итоговых файлов будут в формате `${filename}(${i}_${parts}).json`" }
	}
}