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
import { WindowsManager } from "../web/windows";
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
			// style.backgroundImage = "url(https://raw.githubusercontent.com/RobolabGs2/test-io/develop/static/img/background/0.jpg)";
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
	// canvasContext.scale(canvasSize / gameSize, canvasSize / gameSize)
	const keyboards = [
		new Keyboard(),
		new Keyboard({
			"ArrowLeft": KeyAction.LEFT,
			"ArrowRight": KeyAction.RIGHT,
			"ArrowUp": KeyAction.UP,
			"ArrowDown": KeyAction.DOWN,
		})
	];

	const gameWindowsContainer = HTML.CreateElement("div")
	const mainWindowsContainer = HTML.CreateElement("div")
	document.body.append(gameWindowsContainer, mainWindowsContainer);
	const gameWindowsManager = new WindowsManager(gameWindowsContainer, styleSheet);
	const mainWindowsManager = new WindowsManager(mainWindowsContainer, styleSheet);

	const maps: Record<string, MapCreator | GameMap> = {
		symmetric: new GameMap(PacManMap, new Size(gameSize, gameSize)),
		symmetric_mini: new GameMap(smallMap, new Size(gameSize, gameSize)),
		symmetric_big: new GameMap(BigPacManMap, new Size(gameSize, gameSize)),
		test: TestMap,
		"random maze": new GameMap(RandomMap, new Size(gameSize, gameSize)),
	}
	type gameCreator = (o: Oddvar, m: MapCreator | GameMap) => GameLogic | undefined;
	const games: Record<string, gameCreator> = {
		"Симуляция с кучей агентов": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MultiagentSimulation(o, m, gameWindowsManager) : undefined,
		"Симуляция с одним агентом": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MonoagentSimulation(o, m, gameWindowsManager) : undefined,
		"Собери квадраты": (o: Oddvar, m: MapCreator | GameMap) => new CollectingSquaresGame(o, m),
	}
	let lastMap = maps["symmetric"];
	let lastGame = games["Симуляция с кучей агентов"];

	const newManager = (game: gameCreator = lastGame, map: MapCreator | GameMap = lastMap) => {
		gameWindowsContainer.innerHTML = "";
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
	const processor = new Processor(newManager());
	document.body.appendChild(canvas);
	// document.body.appendChild(CreateWindow("Buffer", bufferCanvas));
	keyboards.map((x, i) => mainWindowsManager.CreateInfoWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20)));
	mainWindowsManager.CreateInfoWindow("Настройки",
		HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.display = "flex"
				style.flexDirection = "row"
			}),
			HTML.Append(
				...([
					["game", games, (value: string) => processor.manager = newManager(games[value], lastMap)],
					["map", maps, (value: string) => processor.manager = newManager(lastGame, maps[value])],
				] as [string, object, (v: string) => void][]).
					map(([name, record, onChange]) => HTML.CreateElement("section", HTML.Append(
						HTML.CreateElement("header", HTML.SetText(`Choose ${name}:`), HTML.SetStyles(s => s.marginRight = "16px")),
						HTML.CreateElement("select",
							HTML.AddEventListener("change", function () {
								try {
									onChange((<HTMLSelectElement>this).value)
								} catch (e) {
									alert(`${e}`)
								}
							}),
							HTML.Append(...Object.keys(record).map((name) => HTML.CreateElement("option",
								HTML.SetText(name),
								(el) => el.value = name,
							)))
						)))))
		), new Point(gameSize, 0)
	)
});