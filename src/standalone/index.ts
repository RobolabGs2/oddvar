import { Processor, ProcessorSettingsInput, ProcessorState, renderSeconds, SimulationLaunch } from "./processor";
import { downloadAsFile, DownloadResources, LinkToDownloadJSON } from "../web/http";
import { World } from "../oddvar/world";
import { LocalPlayers } from "./players";
import { Physics } from "../oddvar/physics/physics";
import { Graphics } from "../oddvar/graphics";
import { Controller } from "../oddvar/controller";
import { TexturesManager } from "../oddvar/textures";
import { Oddvar, Worlds } from "../oddvar/oddvar";
import { HasMultiplayer, Manager } from "../oddvar/manager";
import { CollectingSquaresGame, PacManMap, BigPacManMap, TestMap, RandomMap } from '../games/collecting_squares/collecting_squares';
import { GameMap } from "../games/utils/game_map";
import { Multiagent } from '../games/multiagent/simulation';
import { DiscreteMonoagent, DiscreteMonoagentSimulation } from '../games/discrete_monoagent/simulation';
import { MonoagentSimulation } from '../games/monoagent/simulation';
import { Keyboard } from "../oddvar/input";
import { HTML } from "../web/html";
import { GetStyleSheet, URIStorage } from "../web/utils";
import { Point, Size } from "../oddvar/geometry";
import { MetricsTable, StyleSheetTree, WindowsManager } from "../web/windows";
import { Labirint } from "../oddvar/labirint/labirint";
import { ConvertRecord } from "../oddvar/utils";
import { IsGameMap, MapType, SimulatorDescription } from "../games/utils/description";
import "./settings.scss"
import { CreateQueueOfLaunches } from "./launches_queue";

console.log("Hello ODDVAR");

const smallMap = Labirint.SymmetryOdd([
	[0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0],
	[0, 0, 0, 0, 1],
	[0, 0, 0, 1, 1]
]).Frame(1);

const smallMap1 = Labirint.SymmetryOdd([
	[0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 1],
	[0, 0, 1, 1, 0, 0],
	[0, 0, 0, 1, 1, 1],
	[0, 0, 0, 0, 0, 0],
	[0, 1, 1, 0, 1, 1]
]).Frame(1);

function utf8_to_b64(str: string): string {
	return window.btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str: string): string {
	return decodeURIComponent(escape(window.atob(str)));
}


type URLSettings<MapID extends string = string, GameID extends string = string> = { map: MapID, game: GameID, deadline: number, settings: string, label: string }

const PROCESSOR_SETTINGS_KEY = "oddvar_processor_settings";
Promise.all([DownloadResources(), GetStyleSheet()]).then(([[reflectionJSON, resources], styleSheet]) => {
	const gameSize = 704//798;
	document.body.style.minWidth = document.body.style.minHeight = `${gameSize}px`;
	const canvas = HTML.CreateElement("canvas", HTML.SetStyles(style => {
		// style.backgroundColor = "rgb(200, 200, 200)"; 
		style.width = style.height = "100%";
	}), AppendToBody, Resize);
	const canvasContext = canvas.getContext("2d")!;
	canvasContext.imageSmoothingEnabled = false;
	const hiddenContext = HTML.CreateElement("canvas", c => { c.height = c.width = gameSize; }).getContext("2d")!;
	const patternContext = HTML.CreateElement("canvas", c => { c.height = c.width = gameSize; }).getContext("2d")!;
	const keyboards = [new Keyboard(Keyboard.Mappings.WASD), new Keyboard(Keyboard.Mappings.Arrows)];

	const gameWindowsManager = new WindowsManager(HTML.CreateElement("div", AppendToBody), new StyleSheetTree(styleSheet));
	const mainWindowsManager = new WindowsManager(HTML.CreateElement("div", AppendToBody), new StyleSheetTree(styleSheet));

	// mainWindowsManager.CreateInfoWindow("Pattern", patternContext.canvas)
	const maps = {
		symmetric_very_mini: { name: "Очень маленький лабиринт", value: new GameMap(smallMap, new Size(gameSize, gameSize)) },
		symmetric_mini: { name: "Маленький лабиринт", value: new GameMap(smallMap1, new Size(gameSize, gameSize)) },
		symmetric: { name: "Лабиринт", value: new GameMap(PacManMap, new Size(gameSize, gameSize)) },
		symmetric_big: { name: "Большой лабиринт", value: new GameMap(BigPacManMap, new Size(gameSize, gameSize)) },
		random_maze: { name: "Случайная карта", value: new GameMap(RandomMap, new Size(gameSize, gameSize)) },
		test: { name: "Карта для тестов физики", value: TestMap },
	}
	const games = {
		multiagent: Multiagent.Description,
		monoagent: Monoagent.Description,
		discrete_monoagent: DiscreteMonoagent.Description,
		collecting_squares: CollectingSquares.Description,
	}
	type MapID = keyof typeof maps;
	type GameID = keyof typeof games;

	const urlSettings = URIStorage<URLSettings<MapID, GameID>>({ map: "symmetric", game: "multiagent", deadline: 0, settings: "", label: "" }, {
		map: new Set(Object.keys(maps) as MapID[]), game: new Set(Object.keys(games) as GameID[]),
		deadline: { has: (item) => item >= 0 }, settings: { has: () => true }, label: { has: () => true }
	});
	const simulationSettingsContainer = HTML.CreateElement("article");
	const processor = new Processor([gameWindowsManager, mainWindowsManager])
	if (sessionStorage && sessionStorage.getItem(PROCESSOR_SETTINGS_KEY)) {
		try {
			processor.settings = JSON.parse(sessionStorage.getItem(PROCESSOR_SETTINGS_KEY)!);
		} catch { }
	}
	processor.addEventListener("settingsChanged", settings => sessionStorage.setItem(PROCESSOR_SETTINGS_KEY, JSON.stringify(settings)));

	const currentRunningLabel = {
		container: HTML.CreateElement("span"),
		update(label?: string, title = "") {
			this.container.textContent = label ? `Текущая симуляция: ${label}` : "Симуляция завершена";
			this.container.title = title;
			document.title = label || "Симуляция завершена";
		}
	}

	function LaunchSimulation(settings: SimulationLaunch) {
		gameWindowsManager.Dispose();
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext, hiddenContext),
			new Controller(false),
			new TexturesManager(resources, patternContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		const newGame = settings.simulator.NewSimulation(oddvar, (<any>maps[<MapID>settings.mapID]).value, gameWindowsManager, settings.settings);
		if (HasMultiplayer(newGame)) {
			keyboards.map((x, i) => gameWindowsManager.CreateInfoWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20)));
		}
		urlSettings.game = <GameID>settings.simulationID;
		urlSettings.map = <MapID>settings.mapID;
		urlSettings.deadline = settings.deadline;
		urlSettings.settings = utf8_to_b64(JSON.stringify(settings.settings));
		urlSettings.label = settings.label;
		processor.launchNewSimulation(new Manager(oddvar, newGame), settings);
		currentRunningLabel.update(settings.label, JSON.stringify(settings, undefined, "  "))
		return false;
	}
	const historyOfLaunches = {
		history: new Array<ProcessorState>(),
		html: HTML.CreateElement("article", HTML.FlexContainer("column"), HTML.SetStyles(s => { s.height = "128px"; s.overflow = "auto" })),
		push(state: ProcessorState) {
			const filename = `${state.launch.label}_${new Date().toISOString()}`;
			const metrics = TransformMetrics(state);
			this.html.appendChild(HTML.ModifyElement(LinkToDownloadJSON(filename, metrics), HTML.SetText(filename, JSON.stringify(metrics, undefined, "  "))))
			this.history.push(state);
		},
		addCurrentStateToList() {
			this.push(processor.state());
		},
		buttonDownloadAll() {
			downloadAsFile(`oddvar`, this.history.map(TransformMetrics));
		},
		buttonClearAll() {
			this.html.childNodes.forEach(node => {
				if (node instanceof HTMLAnchorElement)
					URL.revokeObjectURL(node.href);
			})
			this.html.innerHTML = "";
			this.history.length = 0;
		},
		buttonAddCurrentStateToList() {
			this.addCurrentStateToList();
		}
	}
	const launchesQueue = CreateQueueOfLaunches(processor, LaunchSimulation, FlatMapArraysOfRawSimulationLaunch, mainWindowsManager);
	processor.drawTicker.push(launchesQueue);
	launchesQueue.updateView();
	let repeatLatest = true;
	processor.addEventListener("finished", function (x) {
		historyOfLaunches.push(x);
		currentRunningLabel.update();
		if (launchesQueue.play()) {
			return;
		}
		if (repeatLatest) {
			LaunchSimulation(x.launch);
		}
	});
	mainWindowsManager.CreateInfoWindow("Настройки", HTML.CreateElement("article", HTML.SetStyles(style => { style.padding = "16px"; style.height = "100%" }), HTML.FlexContainer("row"), HTML.Append(
		HTML.CreateElement("article", HTML.SetStyles(style => { style.paddingLeft = style.paddingRight = "16px"; style.height = "100%"; style.width = "280px" }), HTML.FlexContainer("column", "space-between"), HTML.Append(
			HTML.CreateElement("section", HTML.Append(
				HTML.CreateElement("header", HTML.SetText(`Choose simulation:`), HTML.SetStyles(s => s.marginRight = "16px")),
				HTML.CreateSelector(urlSettings.game, ConvertRecord(games, (_, o) => o.name), (key) => {
					if (urlSettings.game !== key) {
						urlSettings.label = urlSettings.settings = "";
					}
					simulationSettingsContainer.innerHTML = "";
					simulationSettingsContainer.appendChild(CreateSimulationSettingsInput(maps, urlSettings, key, games[key] as SimulatorDescription<object, MapType>,
						{
							Start: (l) => LaunchSimulation(l),
							Enqueue: (l) => launchesQueue.enqueue(l),
							EnqeueX5: (l) => l.copyN(5).forEach(l => launchesQueue.enqueue(l)),
							EnqeueX10: (l) => l.copyN(10).forEach(l => launchesQueue.enqueue(l)),
						}, "Start"));
				}),
			)),
			currentRunningLabel.container,
			aritcleWithButtons(launchesQueue),
			HTML.CreateElement("section",
				HTML.Append(
					HTML.ModifyElement(mainWindowsManager.CreateTable(processor.metricsTable, MetricsTable.header), HTML.SetStyles(s => s.flex = "1")),
					HTML.CreateElement("footer", HTML.FlexContainer("row", "space-between"), HTML.Append(
						HTML.ModifyElement(HTML.CreateSwitcher(
							() => processor.isPlaying(), (play) => { if (play) processor.play(); else processor.pause() }, { on: "Play|Pause", off: "Play|Pause" }),
							HTML.SetStyles(s => s.flex = "1")),
						HTML.CreateElement("button",
							HTML.SetStyles(s => s.flex = "1"),
							HTML.SetText("Download metrics"),
							HTML.AddEventListener("click", () => {
								const a = LinkToDownloadJSON(`oddvar_${urlSettings.game}_${urlSettings.map}`, TransformMetrics(processor.state()))
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								URL.revokeObjectURL(a.href);
							}))
					)),
				)),
			HTML.Input.CreateForm(ProcessorSettingsInput, {
				Apply: (settings) => processor.settings = settings,
				Deafult: (settings, actual) => actual(processor.settings = { FPS: 60, TPS: 66.6, dt: 0 }),
				Fast: (settings, actual) => actual(processor.settings = { FPS: 60, TPS: 666, dt: 0.02 }),
				MaxPerfomance: (settings, actual) => actual(processor.settings = { FPS: 1, TPS: 66666, dt: 0.02 }),
			}, undefined, processor.settings),
		), HTML.ModifyChildren(HTML.SetStyles(s => s.paddingBottom = "16px"))),
		HTML.CreateElement("article",
			HTML.Append(
				simulationSettingsContainer,
				HTML.CreateElement("footer", HTML.FlexContainer("row", "space-around"), HTML.Append(
					HTML.CreateElement("input", HTML.SetInputType("checkbox"), (el) => el.checked = repeatLatest, HTML.AddEventListener("change", function () { repeatLatest = (<HTMLInputElement>this).checked; })),
					HTML.CreateElement("span", HTML.SetText("Повторять последние настройки"))))

			),
		))), new Point(gameSize, 0));
	mainWindowsManager.CreateInfoWindow("История запусков", aritcleWithButtons(historyOfLaunches), new Point(0, gameSize))


	function FlatMapArraysOfRawSimulationLaunch(x: any[]) {
		return Promise.all(new Array<SimulationLaunch>().concat(...x.map(arr => arr.map((raw: SimulationLaunch) => {
			console.log(raw);
			return Promise.resolve(new SimulationLaunch(raw.simulationID, games[raw.simulationID as GameID], raw.settings, raw.mapID, raw.deadline, raw.label));
		}))))
	}
});

type SimulationSettings<MapID, SettingsT> = {
	map: keyof MapID;
	simulation: SettingsT;
	deadline: number;
	label: string;
};


function newLaunch<MapT extends MapType>(key: string, s: SimulatorDescription<object, MapT>, l: SimulationSettings<MapT, object>): SimulationLaunch<object> {
	return new SimulationLaunch(key, s, l.simulation, l.map as string, l.deadline, l.label);
}

function aritcleWithButtons(objectWithButtons: { html: HTMLElement; } & Record<string, any>): HTMLElement {
	return HTML.CreateElement("article", HTML.Append(objectWithButtons.html,
		HTML.CreateElement("footer", HTML.FlexContainer("row", "space-around", { wrap: true }), HTML.Append(Object.keys(objectWithButtons).filter((key) => key.startsWith("button")).
			map(key => HTML.CreateElement("button", HTML.SetStyles(s => s.flex = "1"), HTML.SetText(key.substr(6)), HTML.AddEventListener("click", () => (<any>objectWithButtons)[key]()))))))
	);
}

function Resize(c: HTMLCanvasElement): void {
	c.height = c.width = 0;
	const resize = () => {
		c.height = c.clientHeight;
		c.width = c.clientWidth;
	};
	window.addEventListener("resize", resize);
	setTimeout(resize, 10);
};

function AppendToBody(el: HTMLElement): void {
	document.body.append(el);
}

function TransformMetrics(s: ProcessorState) {
	return { settings: s.launch, timings: s.metrics, simulation: s.manager?.metrics };
}



function tryParse(str: string) {
	try {
		const obj = JSON.parse(b64_to_utf8(str));
		if (obj !== null && typeof obj === "object")
			return obj;
	} catch (error) {
		console.warn(`Failed decode sim settings from url: ${error}`)
	}
	return undefined;
}

function CreateSimulationSettingsInput<SettingsT extends object, MapT extends MapType, MapID extends string>(
	allMaps: Record<MapID, { name: string, value: MapType }>,
	defaults: URLSettings<MapID>,
	simulationID: string,
	description: SimulatorDescription<SettingsT, MapT>,
	buttons: Record<string, (launch: SimulationLaunch) => void>,
	clickButton: string): HTMLElement {
	const supportedMaps = Object.fromEntries(Object.entries(allMaps).filter(([_, desc]) => description.IsSupportedMap((<any>desc).value))) as Record<MapID, { name: string, value: MapType }>;
	const defaultSettings = defaults.settings === "" ? undefined : tryParse(defaults.settings);
	return HTML.Input.CreateForm({
		type: "object", values: {
			label: { type: "string", default: defaults.label || simulationID, description: "Текстовая метка конфигурируемого запуска, будет использоваться в истории запусков, также будет в метриках." },
			map: { type: "enum", values: ConvertRecord(supportedMaps, (_, o) => o.name), default: defaults.map as string },
			deadline: { type: "float", default: defaults.deadline, min: 0, description: "Через столько секунд принудительно закончится текущая симуляция, 0 - никогда" },
			simulation: { type: "object", values: description.SettingsInputType() },
		}
	}, ConvertRecord(buttons, (_, listener) => (settings: SimulationSettings<MapT, SettingsT>) => listener(newLaunch(simulationID, description, settings))), clickButton,
		{ simulation: defaultSettings }
	);
}

namespace CollectingSquares {
	export type Settings = { debug: boolean, targetColor: string }
	export const Description: SimulatorDescription<Settings, MapType> = {
		name: "Игра 'Собери квадраты'",
		NewSimulation(oddvar: Oddvar, map: GameMap, ui: WindowsManager, settings: Settings) {
			return new CollectingSquaresGame(oddvar, map, settings.targetColor, settings.debug);
		},
		IsSupportedMap: function (m: MapType): m is MapType { return true },
		SettingsInputType() {
			return {
				targetColor: { type: "color", default: "#009900" },
				debug: { type: "boolean", default: false },
			}
		},
	}
}

namespace Monoagent {
	export type Settings = { debug: boolean }
	export const Description: SimulatorDescription<Settings, GameMap> = {
		name: "Симуляция с одним агентом",
		NewSimulation(oddvar: Oddvar, map: GameMap, ui: WindowsManager, settings: Settings) {
			return new MonoagentSimulation(oddvar, map, ui, settings.debug);
		},
		IsSupportedMap: IsGameMap,
		SettingsInputType() {
			return {
				debug: { type: "boolean", default: false },
			}
		},
	}
}
