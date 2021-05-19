import { Processor, ProcessorState, SimulationLaunch } from "./processor";
import { DownloadResources } from "../web/http";
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
import { DiscreteMonoagentSimulation } from '../games/discrete_monoagent/simulation';
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

console.log("Hello ODDVAR");

const smallMap = Labirint.SymmetryOdd([
	[0, 0, 0, 0],
	[0, 0, 0, 0],
	[0, 0, 0, 1],
	[0, 0, 1, 1]
]).Frame(1);

type URLSettings<MapID extends string = string, GameID extends string = string> = { map: MapID, game: GameID, deadline: number }

Promise.all([DownloadResources(), GetStyleSheet()]).then(([[reflectionJSON, resources], styleSheet]) => {
	const gameSize = 800;
	document.body.style.minWidth = document.body.style.minHeight = `${gameSize}px`;
	const canvas = HTML.CreateElement("canvas", HTML.SetStyles(style => { style.backgroundColor = "rgb(200, 200, 200)"; style.width = style.height = "100%"; }), AppendToBody, Resize);
	const canvasContext = canvas.getContext("2d")!;
	canvasContext.imageSmoothingEnabled = false;
	const hiddenContext = HTML.CreateElement("canvas", c => { c.height = c.width = gameSize; }).getContext("2d")!;
	const keyboards = [new Keyboard(Keyboard.Mappings.WASD), new Keyboard(Keyboard.Mappings.Arrows)];

	const gameWindowsManager = new WindowsManager(HTML.CreateElement("div", AppendToBody), new StyleSheetTree(styleSheet));
	const mainWindowsManager = new WindowsManager(HTML.CreateElement("div", AppendToBody), new StyleSheetTree(styleSheet));

	const maps = {
		symmetric: { name: "Лабиринт", value: new GameMap(PacManMap, new Size(gameSize, gameSize)) },
		symmetric_mini: { name: "Маленький лабиринт", value: new GameMap(smallMap, new Size(gameSize, gameSize)) },
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

	const urlSettings = URIStorage<URLSettings<MapID, GameID>>({ map: "symmetric", game: "multiagent", deadline: 0 }, {
		map: new Set(Object.keys(maps) as MapID[]), game: new Set(Object.keys(games) as GameID[]),
		deadline: { has: (item) => item >= 0 }
	});
	const simulationSettingsContainer = HTML.CreateElement("article");
	const processor = new Processor([gameWindowsManager, mainWindowsManager])

	function LaunchSimulation(settings: SimulationLaunch) {
		gameWindowsManager.Dispose();
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext, hiddenContext),
			new Controller(false),
			new TexturesManager(resources, canvasContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		const newGame = settings.simulator.NewSimulation(oddvar, (<any>maps[<MapID>settings.mapID]).value, gameWindowsManager, settings.settings);
		if (HasMultiplayer(newGame)) {
			keyboards.map((x, i) => gameWindowsManager.CreateInfoWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20)));
		}
		urlSettings.game = <GameID>settings.simulationID;
		urlSettings.map = <MapID>settings.mapID;
		urlSettings.deadline = settings.deadline;
		processor.launchNewSimulation(new Manager(oddvar, newGame), settings);
		return false;
	}
	const historyOfLaunches = {
		history: new Array<ProcessorState>(),
		html: HTML.CreateElement("article", HTML.FlexContainer("column"), HTML.SetStyles(s => { s.height = "128px"; s.overflow = "auto" })),
		push(state: ProcessorState) {
			const filename = `${state.launch.simulationID}_${state.launch.mapID}_${new Date().toISOString()}`;
			this.html.appendChild(HTML.ModifyElement(LinkToDownloadJSON(filename, TransformMetrics(state)), HTML.SetText(filename)))
			this.history.push(state);
		},
		addCurrentStateToList() {
			this.push(processor.state());
		},
		buttonDownloadAll() {
			const a = LinkToDownloadJSON(`oddvar`, this.history.map(TransformMetrics));
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(a.href);
		},
		buttonClearAll() {
			this.html.innerHTML = "";
			this.history.length = 0;
		},
		buttonAddCurrentStateToList() {
			this.addCurrentStateToList();
		}
	}
	const launchesQueue = {
		queue: new Array<SimulationLaunch>(),
		enqueue(launch: SimulationLaunch) { this.queue.push(launch); this.updateView(); },
		html: HTML.CreateElement("div", HTML.SetStyles(s => s.height = "128px")),
		updateView() {
			this.html.innerText = `В очереди: ${this.queue.length}`;
		},
		dequeue() {
			if (this.empty()) throw new Error(`Dequeue on empty queue`);
			const item = this.queue.shift()!;
			this.updateView();
			return item;
		},
		empty() { return this.queue.length === 0 },
		play() {
			if (this.empty()) return false;
			LaunchSimulation(this.dequeue());
			return true;
		},
		buttonPlayFromQueue() { this.play(); },
		buttonCleanQueue() { this.queue.length = 0; },
	}
	launchesQueue.updateView();
	let repeatLatest = true;
	processor.addEventListener("finished", function (x) {
		historyOfLaunches.push(x)
		if (launchesQueue.play()) {
			return;
		}
		if (repeatLatest) {
			LaunchSimulation(x.launch);
		}
	});
	mainWindowsManager.CreateInfoWindow("История запусков", aritcleWithButtons(historyOfLaunches), new Point(0, gameSize))
	mainWindowsManager.CreateInfoWindow("Настройки", HTML.CreateElement("article", HTML.FlexContainer(), HTML.Append(
		HTML.CreateElement("article", HTML.Append(
			HTML.CreateElement("section", HTML.Append(
				HTML.CreateElement("header", HTML.SetText(`Choose simulation:`), HTML.SetStyles(s => s.marginRight = "16px")),
				HTML.CreateSelector(urlSettings.game, ConvertRecord(games, (_, o) => o.name), (key) => {
					simulationSettingsContainer.innerHTML = "";
					simulationSettingsContainer.appendChild(CreateSettingsInput(maps, urlSettings, games[key],
						{
							Start: (s, l) => LaunchSimulation(new SimulationLaunch(key, s, l.simulation, l.map, l.deadline)),
							Queue: (s, l) => launchesQueue.enqueue(new SimulationLaunch(key, s, l.simulation, l.map, l.deadline)),
						}, "Start"));
				}),
			)),
			simulationSettingsContainer,
			HTML.CreateElement("footer", HTML.FlexContainer("row", "space-around"), HTML.Append(
				HTML.CreateElement("input", HTML.SetInputType("checkbox"), (el) => el.checked = repeatLatest, HTML.AddEventListener("change", function () { repeatLatest = (<HTMLInputElement>this).checked; })),
				HTML.CreateElement("span", HTML.SetText("Повторять последние настройки"))))
		)),
		HTML.CreateElement("article",
			HTML.Append(HTML.CreateElement("section",
				HTML.Append(
					HTML.ModifyElement(mainWindowsManager.CreateTable(processor.metricsTable, MetricsTable.header), HTML.SetStyles(s => s.flex = "1")),
					HTML.CreateElement("footer", HTML.Append(
						HTML.ModifyElement(HTML.CreateSwitcher(
							() => processor.isPlaying(), (play) => { if (play) processor.play(); else processor.pause() }, { on: "Play", off: "Pause" }),
							HTML.SetStyles(s => s.height = "100%")),
						HTML.CreateElement("button",
							HTML.SetText("Download metrics"),
							HTML.AddEventListener("click", () => {
								const a = LinkToDownloadJSON(`oddvar_${urlSettings.game}_${urlSettings.map}`, TransformMetrics(processor.state()))
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								URL.revokeObjectURL(a.href);
							}))
					)),
				),
				HTML.SetStyles(style => {
					style.display = "flex"
					style.flex = "1";
					style.flexDirection = "column";
					style.justifyContent = "space-between";
					style.padding = "16px";
				})),
				aritcleWithButtons(launchesQueue)
			),
		))), new Point(gameSize, 0))
});

type SimulationSettings<MapID, SettingsT> = {
	map: keyof MapID;
	simulation: SettingsT;
	deadline: number;
};

function aritcleWithButtons(objectWithButtons: { html: HTMLElement; } & Record<string, any>): HTMLElement {
	return HTML.CreateElement("article", HTML.Append(objectWithButtons.html,
		Object.keys(objectWithButtons).filter((key) => key.startsWith("button")).
			map(key => HTML.CreateElement("button", HTML.SetText(key.substr(6)), HTML.AddEventListener("click", () => (<any>objectWithButtons)[key]()))))
	);
}

function LinkToDownloadJSON(filename: string, obj: any): HTMLAnchorElement {
	const json = JSON.stringify(obj);
	const blob = new Blob([json], { type: "application/json" });
	const a = document.createElement("a");
	a.download = `${filename}.json`;
	a.href = URL.createObjectURL(blob);
	return a;
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

function CreateSettingsInput<SettingsT extends object, MapT extends MapType, MapID extends string>(
	allMaps: Record<MapID, { name: string, value: MapType }>,
	defaults: URLSettings<MapID>,
	description: SimulatorDescription<SettingsT, MapT>,
	buttons: Record<string, (game: SimulatorDescription<SettingsT, MapT>, s: SimulationSettings<MapT, SettingsT>) => void>,
	clickButton: string): HTMLElement {
	const output = {} as { root: SimulationSettings<MapT, SettingsT> };
	const supportedMaps = Object.fromEntries(Object.entries(allMaps).filter(([_, desc]) => description.IsSupportedMap((<any>desc).value))) as Record<MapID, { name: string, value: MapType }>;
	const h = HTML.Input.CreateTypedInput("root", {
		type: "object", values: {
			map: { type: "enum", values: ConvertRecord(supportedMaps, (_, o) => o.name), default: defaults.map as string },
			deadline: { type: "float", default: defaults.deadline },
			simulation: { type: "object", values: description.SettingsInputType() },
		}
	}, output);
	return HTML.CreateElement("article", HTML.AddClass("settings-input"), HTML.Append(
		HTML.CreateElement("header"),
		HTML.CreateElement("section", HTML.Append(h), HTML.SetStyles(s => s.width = "256px")),
		HTML.CreateElement("footer", HTML.FlexContainer("row", "space-around"), HTML.Append(Object.entries(buttons).map(([text, listener]) =>
			HTML.CreateElement("button", HTML.SetStyles(s => { s.flex = "1"; s.margin = "8px" }),
				HTML.SetText(text), HTML.AddEventListener("click", () => listener(description, JSON.parse(JSON.stringify(output.root)))), (el) => { if (text === clickButton) el.click() })
		)))
	));
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

namespace DiscreteMonoagent {
	export type Settings = { debug: boolean }
	export const Description: SimulatorDescription<Settings, GameMap> = {
		name: "Симуляция с одним агентом на клеточках",
		NewSimulation(oddvar: Oddvar, map: GameMap, ui: WindowsManager, settings: Settings) {
			return new DiscreteMonoagentSimulation(oddvar, map, ui, settings.debug);
		},
		IsSupportedMap: IsGameMap,
		SettingsInputType() {
			return {
				debug: { type: "boolean", default: false },
			}
		},
	}
}