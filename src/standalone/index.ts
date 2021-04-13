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

console.log("Hello ODDVAR");

DownloadResources().then(([reflectionJSON, resources]) => {
	const gameSize = 800;
	document.body.style.minWidth = document.body.style.minHeight = `${gameSize}px`;
	document.body.style.height = "100vh";
	document.body.style.width = "100vw";
	document.head.appendChild(HTML.CreateElement("style",
		(style: HTMLStyleElement) => {
			setTimeout(() => {
				style.sheet!.addRule(`*`, `margin: 0; padding: 0;`);
			});
		}))
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

	const maps: Record<string, MapCreator | GameMap> = {
		symmetric: new GameMap(PacManMap, new Size(gameSize, gameSize)),
		symmetric_big: new GameMap(BigPacManMap, new Size(gameSize, gameSize)),
		test: TestMap,
		"random maze": new GameMap(RandomMap, new Size(gameSize, gameSize)),
	}
	type gameCreator = (o: Oddvar, m: MapCreator | GameMap) => GameLogic | undefined;
	const games: Record<string, gameCreator> = {
		"Симуляция с кучей агентов": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MultiagentSimulation(o, m) : undefined,
		"Симуляция с одним агентом": (o: Oddvar, m: MapCreator | GameMap) => (m instanceof GameMap) ? new MonoagentSimulation(o, m) : undefined,
		"Собери квадраты": (o: Oddvar, m: MapCreator | GameMap) => new CollectingSquaresGame(o, m),
	}
	let lastMap = maps["symmetric"];
	let lastGame = games["Симуляция с кучей агентов"];

	const newManager = (game: gameCreator = lastGame, map: MapCreator | GameMap = lastMap) => {
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
	keyboards.map((x, i) => CreateWindow(`Player ${i}`, x.joystick(), new Point(i * (gameSize - gameSize / 5), gameSize - 20))).forEach(el => document.body.appendChild(el))
	document.body.appendChild(
		CreateWindow("Настройки",
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
	)
});

function CreateHeader(title: string, move: HTMLElement): HTMLElement {
	let pos: Point | null;
	let startPos: Point | null;
	const onMove = (next: Point, elem: HTMLElement) => {
		if (pos == null || startPos == null)
			return;
		const delta = next.Sub(pos);
		elem.style.left = `${startPos.x + delta.x}px`;
		elem.style.top = `${startPos.y + delta.y}px`;
	}
	return HTML.CreateElement("header",
		HTML.SetStyles(style => {
			style.borderBottom = "solid 1px";
			style.display = "flex";
			style.height = "1.3em";
		}),
		HTML.Append(
			HTML.CreateElement("header", HTML.SetText(title)),
			HTML.CreateElement("section",
				HTML.SetStyles(style => { style.cursor = "move"; style.flex = "1"; style.minWidth = "64px" }),
				HTML.AddEventListener("mousedown", function (ev) {
					if (ev.target !== this) return;
					ev.preventDefault();
					const rect = move.getBoundingClientRect();
					pos = new Point(ev.pageX, ev.pageY);
					startPos = new Point(rect.x, rect.y);
				}),
				HTML.AddEventListener("mousemove", function (ev) {
					if (ev.target !== this) return;
					ev.preventDefault();
					onMove(new Point(ev.pageX, ev.pageY), move);
				}),
				HTML.AddEventListener("mouseup", function (ev) {
					if (ev.target !== this) return;
					ev.preventDefault();
					pos = startPos = null;
				}),
				HTML.AddEventListener("mouseover", function (ev) {
					if (ev.target !== this) return;
					ev.preventDefault();
					pos = startPos = null;
				}),
			),
			HTML.CreateElement("section",
				HTML.Append(
					HTML.CreateElement("button", HTML.SetText("🗕"),
						HTML.AddEventListener("click", function (ev) {
							const children = move.childNodes.item(1) as HTMLElement;
							children.style.display = children.style.display === "none" ? "" : "none"
							this.innerText = this.innerText === "🗕" ? "🗖" : "🗕"
						})),
					// HTML.CreateElement("button", HTML.SetText("X"), (el) => el.disabled = true)
				)),
		)
	);
}

function CreateWindow(title: string, inner: HTMLElement, defaultPosition = Point.Zero): HTMLElement {
	const window = HTML.CreateElement("article",
		HTML.SetStyles(style => {
			style.position = "absolute";
			style.border = "double 5px";
			style.left = `${defaultPosition.x}px`;
			style.top = `${defaultPosition.y}px`;
			style.backgroundColor = "rgba(250, 250, 250, 0.6)"
		}))
	return HTML.ModifyElement(window,
		HTML.Append(
			CreateHeader(title, window),
			HTML.CreateElement("section", HTML.Append(inner))
		)
	)
}