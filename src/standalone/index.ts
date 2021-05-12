import { Processor } from "./processor";
import { DownloadResources } from "../web/http";
import { World } from "../oddvar/world";
import { LocalPlayers } from "./players";
import { Physics } from "../oddvar/physics/physics";
import { Graphics } from "../oddvar/graphics";
import { Controller } from "../oddvar/controller";
import { TexturesManager } from "../oddvar/textures";
import { Oddvar, Worlds } from "../oddvar/oddvar";
import { Manager } from "../oddvar/manager";
import { CollectingSquaresGame, MapCreator, PacManMap, BigPacManMap, TestMap, RandomMap } from '../games/collecting_squares/collecting_squares';
import { GameMap } from "../games/utils/game_map";
import { MultiagentSimulation } from '../games/multiagent/simulation';
import { MonoagentSimulation } from '../games/monoagent/simulation';
import { Keyboard } from "../oddvar/input";
import { HTML } from "../web/html";
import { Point, Size } from "../oddvar/geometry";
import { MetricsTable, StyleSheetTree, WindowsManager } from "../web/windows";
import { Labirint } from "../oddvar/labirint/labirint";
import { ConvertRecord } from "../oddvar/utils";

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

interface Holder<T> {
	has(item: T): boolean
}

type MapOfSets<T> = {
	[K in keyof T]: Holder<T[K]>
}

function URIStorage<T extends object>(defaults: T, constraints: MapOfSets<T>): T {
	function getURL() {
		return new URL(location.href);
	}
	return new Proxy<T>(Object.create(null), {
		get: (_, field) => {
			if (typeof field !== "string")
				return;
			const constraint = constraints[field as keyof MapOfSets<T>];
			if (constraint === undefined)
				return;
			const url = getURL();
			const value = (url.searchParams.get(field) || "");
			if (constraint.has(value as any)) return value;
			const defaultValue = (defaults as unknown as any)[field];
			url.searchParams.set(field, defaultValue);
			history.pushState(null, "", url.toString());
			return defaultValue;
		},
		set: (_, field, value) => {
			if (typeof field !== "string")
				return false;
			const url = getURL();
			if (url.searchParams.get(field) === value)
				return true;
			url.searchParams.set(field, value);
			history.pushState(null, "", url.toString());
			return true;
		},
	})
}

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
			value: (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MultiagentSimulation(o, m, gameWindowsManager) : undefined,
		},
		monoagent: {
			name: "Симуляция с одним агентом",
			value: (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MonoagentSimulation(o, m, gameWindowsManager) : undefined,
		},
		collecting_squares: {
			name: "Игра 'Собери квадраты'",
			value: (o: Oddvar, m: MapCreator | GameMap) => new CollectingSquaresGame(o, m),
		},
	}
	type MapID = keyof typeof maps;
	type GameID = keyof typeof games;
	type SimulationSettings = { map: MapID, game: GameID }

	const settings = URIStorage<SimulationSettings>({ map: "symmetric", game: "multiagent" }, { map: new Set(Object.keys(maps) as MapID[]), game: new Set(Object.keys(games) as GameID[]) });

	const newManager = (game: GameID = settings.game, map: MapID = settings.map) => {
		gameWindowsManager.Dispose();
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext, hiddenContext),
			new Controller(false),
			new TexturesManager(resources, canvasContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		const newGame = games[game].value(oddvar, maps[map].value);
		if (newGame === undefined) {
			throw new Error(`Карта и игра несовместимы`);
		}
		settings.game = game;
		settings.map = map;
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
			["game", games, (value) => processor.manager = newManager(value, undefined)],
			["map", maps, (value) => processor.manager = newManager(undefined, value)],
		] as [keyof SimulationSettings, Record<string, { name: string }>, (v: any) => void][]).
			map(([name, labels, onChange]) => HTML.CreateElement("section", HTML.Append(
				HTML.CreateElement("header", HTML.SetText(`Choose ${name}:`), HTML.SetStyles(s => s.marginRight = "16px")),
				CreateSelector(settings[name], ConvertRecord(labels, (_, o) => o.name), onChange)
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

function CreateSelector<T extends string>(defaultKey: T, options: Record<T, string>, onChange: (value: T) => void) {
	return HTML.CreateElement("select",
		HTML.AddEventListener("change", function () {
			try {
				onChange(<T>(<HTMLSelectElement>this).value)
			} catch (e) {
				alert(`${e}`)
			}
		}),
		HTML.Append(...Object.entries(options).map(([value, text]) => HTML.CreateElement("option", HTML.SetText(text as string), (el) => el.value = value))),
		el => {
			el.selectedIndex = Object.keys(options).findIndex(k => k === defaultKey);
		}
	)
}