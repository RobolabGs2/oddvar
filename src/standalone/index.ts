import { Processor } from "./processor";
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

Promise.all([DownloadResources(), GetStyleSheet()]).then(([[reflectionJSON, resources], styleSheet]) => {
	const gameSize = 800;
	document.body.style.minWidth = document.body.style.minHeight = `${gameSize}px`;
	document.body.style.height = "100vh";
	document.body.style.width = "100vw";
	document.body.style.overflow = "hidden";
	const canvas = HTML.CreateElement("canvas",
		HTML.SetStyles(style => {
			style.backgroundColor = "rgb(200, 200, 200)"
			style.width = style.height = "100%";
		}),
		c => {
			c.height = c.width = 0;
			document.body.append(c);
			const resize = () => {
				c.height = c.clientHeight;
				c.width = c.clientWidth;
			};
			window.addEventListener("resize", resize);
			setTimeout(resize, 10)
		});
	const canvasContext = canvas.getContext("2d")!;
	canvasContext.imageSmoothingEnabled = false;
	const bufferCanvas = HTML.CreateElement("canvas", c => { c.height = c.width = gameSize; });
	const hiddenContext = bufferCanvas.getContext("2d")!;
	const keyboards = [new Keyboard(Keyboard.Mappings.WASD), new Keyboard(Keyboard.Mappings.Arrows)];

	const gameWindowsContainer = HTML.CreateElement("div")
	const mainWindowsContainer = HTML.CreateElement("div")
	document.body.append(gameWindowsContainer, mainWindowsContainer);
	const gameWindowsManager = new WindowsManager(gameWindowsContainer, new StyleSheetTree(styleSheet));
	const mainWindowsManager = new WindowsManager(mainWindowsContainer, new StyleSheetTree(styleSheet));

	const maps = {
		symmetric: { name: "Лабиринт", value: new GameMap(PacManMap, new Size(gameSize, gameSize)) },
		symmetric_mini: { name: "Маленький лабиринт", value: new GameMap(smallMap, new Size(gameSize, gameSize)) },
		symmetric_big: { name: "Большой лабиринт", value: new GameMap(BigPacManMap, new Size(gameSize, gameSize)) },
		random_maze: { name: "Случайная карта", value: new GameMap(RandomMap, new Size(gameSize, gameSize)) },
		test: { name: "Карта для тестов физики", value: TestMap },
	}
	const games = {
		multiagent: {
			name: "Симуляция с кучей агентов",
			value: Multiagent.Description,
		},
		monoagent: {
			name: "Симуляция с одним агентом",
			value: Monoagent.Description,
		},
		collecting_squares: {
			name: "Игра 'Собери квадраты'",
			value: CollectingSquares.Description
		},
	}
	type MapID = keyof typeof maps;
	type GameID = keyof typeof games;
	type SimulationSettings = { map: MapID, game: GameID }
	const settings = URIStorage<SimulationSettings>({ map: "symmetric", game: "multiagent" }, { map: new Set(Object.keys(maps) as MapID[]), game: new Set(Object.keys(games) as GameID[]) });
	document.body.appendChild(canvas);
	const simulationSettingsContainer = HTML.CreateElement("article");
	const processor = new Processor([gameWindowsManager, mainWindowsManager])
	mainWindowsManager.CreateInfoWindow("Настройки", HTML.CreateElement("article", HTML.FlexContainer(), HTML.Append(
		HTML.CreateElement("article", HTML.Append(
			HTML.CreateElement("section", HTML.Append(
				HTML.CreateElement("header", HTML.SetText(`Choose simulation:`), HTML.SetStyles(s => s.marginRight = "16px")),
				HTML.CreateSelector(settings.game, ConvertRecord(games, (_, o) => o.name), (key) => {
					simulationSettingsContainer.innerHTML = "";
					const selectedGame = games[key].value;
					simulationSettingsContainer.appendChild(CreateSettingsInput(maps, settings.map, selectedGame as any, (simulation, launchSettings) => {
						gameWindowsManager.Dispose();
						const worlds = new Worlds(
							new World(),
							new LocalPlayers(keyboards),
							new Physics(),
							new Graphics(canvasContext, hiddenContext),
							new Controller(false),
							new TexturesManager(resources, canvasContext))
						const oddvar = new Oddvar(worlds, reflectionJSON);
						const newGame = simulation.NewSimulation(oddvar, (<any>maps[launchSettings.map]).value, gameWindowsManager, launchSettings.simulation);
						if (newGame === undefined) {
							throw new Error(`Карта и игра несовместимы`);
						}
						if (HasMultiplayer(newGame)) {
							keyboards.map((x, i) => gameWindowsManager.CreateInfoWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20)));
						}
						settings.game = key;
						settings.map = launchSettings.map;
						processor.manager = new Manager(oddvar, newGame);
						return false;
					}));
				})
			)),
			simulationSettingsContainer
		)),
		HTML.CreateElement("article",
			HTML.Append(HTML.CreateElement("section",
				HTML.Append(
					HTML.ModifyElement(mainWindowsManager.CreateTable(processor.metricsTable, MetricsTable.header), HTML.SetStyles(s => s.flex = "1")),
					HTML.CreateElement("footer", HTML.Append(
						HTML.ModifyElement(
							HTML.CreateSwitcher(
								() => processor.isPlaying(),
								(play) => { if (play) processor.play(); else processor.pause() },
								{ on: "Play", off: "Pause" }),
							HTML.SetStyles(s => s.height = "100%")
						),
						HTML.CreateElement("button",
							HTML.SetText("Download metrics"),
							HTML.AddEventListener("click", () => {
								const json = JSON.stringify({ settings: settings, timeings: processor.processorMetrics, simulation: processor.manager?.metrics });
								const blob = new Blob([json], { type: "application/json" });
								const a = document.createElement("a");
								a.download = `oddvar_${settings.game}_${settings.map}.json`;
								a.href = URL.createObjectURL(blob);
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								URL.revokeObjectURL(a.href);
							})
						)
					))

				),
				HTML.SetStyles(style => {
					style.display = "flex"
					style.flex = "1";
					style.flexDirection = "column";
					style.justifyContent = "space-between";
					style.padding = "16px";
				})
			)),
		))), new Point(gameSize, 0))
});

type SimulationSettings<MapID, SettingsT> = {
	map: keyof MapID;
	simulation: SettingsT;
};

function CreateSettingsInput<SettingsT extends object, MapT extends MapType, MapID extends string>(
	allMaps: Record<MapID, { name: string, value: MapType }>,
	defaultMap: string,
	description: SimulatorDescription<SettingsT, MapT>, onSubmit: (game: SimulatorDescription<SettingsT, MapT>, s: SimulationSettings<MapT, SettingsT>) => boolean): HTMLElement {
	const output = {} as { root: SimulationSettings<MapT, SettingsT> };
	const supportedMaps = Object.fromEntries(Object.entries(allMaps).filter(([_, desc]) => description.IsSupportedMap((<any>desc).value))) as Record<MapID, { name: string, value: MapType }>;
	const h = HTML.Input.CreateTypedInput("root", {
		type: "object", values: {
			map: { type: "enum", values: ConvertRecord(supportedMaps, (_, o) => o.name), default: defaultMap },
			simulation: { type: "object", values: description.SettingsInputType() },
		}
	}, output);
	return HTML.CreateElement("article", HTML.AddClass("settings-input"), HTML.Append(
		HTML.CreateElement("header"),
		HTML.CreateElement("section", HTML.Append(h), HTML.SetStyles(s => s.width = "256px")),
		HTML.CreateElement("footer", HTML.Append(HTML.CreateElement("button", HTML.SetText("Start"), HTML.AddEventListener("click", () => onSubmit(description, output.root)), (el) => el.click())))
	));
}

namespace CollectingSquares {
	export type Settings = { debug: boolean, targetColor: string }
	export const Description: SimulatorDescription<Settings, MapType> = {
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