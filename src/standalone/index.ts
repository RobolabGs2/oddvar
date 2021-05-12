import { Processor } from "./processor";
import { DownloadResources } from "../web/http";
import { World } from "../oddvar/world";
import { LocalPlayers } from "./players";
import { Physics } from "../oddvar/physics/physics";
import { Graphics } from "../oddvar/graphics";
import { Controller } from "../oddvar/controller";
import { TexturesManager } from "../oddvar/textures";
import { Oddvar, Worlds } from "../oddvar/oddvar";
import { GameLogic, Manager } from "../oddvar/manager";
import { CollectingSquaresGame, MapCreator, PacManMap, BigPacManMap, TestMap, RandomMap } from '../games/collecting_squares/collecting_squares';
import { GameMap } from "../games/utils/game_map";
import { MultiagentSimulation } from '../games/multiagent/simulation';
import { MonoagentSimulation } from '../games/monoagent/simulation';
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";
import { HTML } from "../web/html";
import { Point, Size } from "../oddvar/geometry";
import { MetricsTable, StyleSheetTree, WindowsManager } from "../web/windows";
import { Labirint } from "../oddvar/labirint/labirint";

console.log("Hello ODDVAR");

function GetStyleSheet(): Promise<CSSStyleSheet> {
	return new Promise((resolve, reject) => {
		document.head.appendChild(HTML.CreateElement("style",
			(style: HTMLStyleElement) => {
				setTimeout(() => {
					const styleSheet = style.sheet;
					if (!styleSheet) {
						reject(new Error("Can't take style sheet"));
						return
					}
					styleSheet.addRule(`*`, `margin: 0; padding: 0;`);
					resolve(styleSheet);
				});
			}))
	})
}

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
		symmetric: new GameMap(PacManMap, new Size(gameSize, gameSize)),
		symmetric_mini: new GameMap(smallMap, new Size(gameSize, gameSize)),
		symmetric_big: new GameMap(BigPacManMap, new Size(gameSize, gameSize)),
		test: TestMap,
		"random maze": new GameMap(RandomMap, new Size(gameSize, gameSize)),
	}
	type gameCreator = (o: Oddvar, m: MapCreator | GameMap) => GameLogic | undefined;
	const games = {
		"Симуляция с кучей агентов": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MultiagentSimulation(o, m, gameWindowsManager) : undefined,
		"Симуляция с одним агентом": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MonoagentSimulation(o, m, gameWindowsManager) : undefined,
		"Собери квадраты": (o: Oddvar, m: MapCreator | GameMap) => new CollectingSquaresGame(o, m),
	}
	type SimulationSettings = { map: keyof typeof maps, game: keyof typeof games }
	const url = new URL(location.href);
	const settings: SimulationSettings = {map:(url.searchParams.get("map")|| "symmetric") as keyof typeof maps, game: (url.searchParams.get("game")|| "Симуляция с кучей агентов") as keyof typeof games}
	let lastMap: MapCreator | GameMap = maps[settings.map];
	let lastGame: gameCreator = games[settings.game];
	
	const newManager = (game: gameCreator = lastGame, map: MapCreator | GameMap = lastMap) => {
		gameWindowsManager.Dispose();
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext, hiddenContext),
			new Controller(false),
			new TexturesManager(resources, canvasContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		lastGame = game;
		const newGame = game(oddvar, lastMap = map);
		if (newGame === undefined) {
			throw new Error(`Карта и игра несовместимы`);
		}
		return new Manager(oddvar, newGame);
	}
	const processor = new Processor(newManager(), [
		gameWindowsManager,
		mainWindowsManager]);
	document.body.appendChild(canvas);
	// document.body.appendChild(CreateWindow("Buffer", bufferCanvas));
	// keyboards.map((x, i) => mainWindowsManager.CreateInfoWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20)));
	mainWindowsManager.CreateInfoWindow("Настройки", HTML.CreateElement("article", HTML.Append(
		HTML.CreateElement("article", HTML.SetStyles(style => { style.display = "flex"; style.flexDirection = "row"; }), HTML.Append(([
			["game", games, (value) => processor.manager = newManager(value, lastMap)],
			["map", maps, (value) => processor.manager = newManager(lastGame, value)],
		] as [keyof SimulationSettings, Record<string, any>, (v: any) => void][]).
			map(([name, record, onChange]) => HTML.CreateElement("section", HTML.Append(
				HTML.CreateElement("header", HTML.SetText(`Choose ${name}:`), HTML.SetStyles(s => s.marginRight = "16px")),
				CreateSelector(name, settings[name], record, onChange)
			))))),
		HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.marginTop = "8px"
				style.display = "flex"
				style.flexDirection = "row"
			}),
			HTML.Append(HTML.CreateElement("section",
				HTML.Append((<[string, Function][]>[["play", processor.play], ["pause", processor.pause]]).
					map(([name, action]) => HTML.CreateElement("button",
						HTML.SetText(name),
						HTML.AddEventListener("click", () => action.call(processor))))),
				HTML.SetStyles(style => {
					style.display = "flex"
					style.flex = "1";
					style.flexDirection = "column";
					style.justifyContent = "space-between";
					style.padding = "16px";
				})
			)),
			HTML.Append(HTML.ModifyElement(mainWindowsManager.CreateTable(processor.metricsTable, MetricsTable.header), HTML.SetStyles(s => s.flex = "1"))),
		))), new Point(gameSize, 0))
});

function CreateSelector<T>(name: string, defaultKey: string, options: Record<string, T>, onChange: (value: T) => void) {
	return HTML.CreateElement("select",
		HTML.AddEventListener("change", function () {
			try {
				const key = (<HTMLSelectElement>this).value;
				onChange(options[key])
				const url = new URL(location.href);
				url.searchParams.set(name, key)
				history.pushState(null, "", url.toString());
			} catch (e) {
				alert(`${e}`)
			}
		}),
		HTML.Append(...Object.keys(options).map(name => HTML.CreateElement("option", HTML.SetText(name), (el) => el.value = name))),
		el => {
			el.selectedIndex = Object.keys(options).findIndex(k => k === defaultKey);
		}
	)
}