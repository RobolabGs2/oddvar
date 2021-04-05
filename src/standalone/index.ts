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
import { CollectingSquaresGame, MapCreator, PacManLikeLabirint, RandomLabirint, TestMap } from '../games/collecting_squares';
import { MultiagentSimulation } from '../games/multuagent_sumulation';
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";
import { HTML } from "../web/html";

console.log("Hello ODDVAR");

DownloadResources().then(([reflectionJSON, resources]) => {
	const gameSize = 500;
	const canvasSize = 900;
	const canvas = HTML.CreateElement("canvas", c => {
		c.height = c.width = canvasSize;
		document.body.append(c);
		c.style.backgroundImage = "url(https://raw.githubusercontent.com/RobolabGs2/test-io/develop/static/img/background/0.jpg)";
	});
	const canvasContext = canvas.getContext("2d")!;
	canvasContext.scale(canvasSize/gameSize, canvasSize/gameSize)
	const keyboards = [
		new Keyboard(),
		new Keyboard({
			"ArrowLeft": KeyAction.LEFT,
			"ArrowRight": KeyAction.RIGHT,
			"ArrowUp": KeyAction.UP,
			"ArrowDown": KeyAction.DOWN,
		})
	];

	const maps: Record<string, MapCreator> = {
		symmetric: PacManLikeLabirint,
		test: TestMap,
		"random maze": RandomLabirint,
	}
	type gameCreator = (o: Oddvar, m: MapCreator) => GameLogic;
	const games: Record<string, gameCreator> = {
		"Симуляция с кучей агентов": (o: Oddvar, m: MapCreator) => new MultiagentSimulation(o, m),
		"Собери квадраты": (o: Oddvar, m: MapCreator) => new CollectingSquaresGame(o, m),
	}
	let lastMap = PacManLikeLabirint;
	let lastGame = games["Симуляция с кучей агентов"];

	const newManager = (game: gameCreator = lastGame, map: MapCreator = lastMap) => {
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext),
			new Controller(false),
			new TexturesManager(resources, canvasContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		lastGame = game;
		return new Manager(oddvar, game(oddvar, lastMap = map));
	}
	const processor = new Processor(newManager());
	document.body.appendChild(
		HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.display = "flex"
				style.flexDirection = "row"
				style.justifyContent = "space-between"
			}),
			HTML.Append(
				HTML.CreateElement("header",
					HTML.SetStyles(style => {
						style.display = "flex"
						style.flexDirection = "column"
					}),
					HTML.Append(
						HTML.CreateElement("section", HTML.Append(
							HTML.CreateElement("header", HTML.SetText("Choose game:"), HTML.SetStyles(s => s.marginRight = "16px")),
							HTML.CreateElement("select",
								HTML.AddEventListener("change", function (ev) {
									const select = this as HTMLSelectElement;
									processor.manager = newManager(games[select.value], lastMap);
								}),
								HTML.Append(...Object.keys(games).map((name) => HTML.CreateElement("option",
									HTML.SetText(name),
									(el) => el.value = name,
								)))
							))),
						HTML.CreateElement("section", HTML.Append(
							HTML.CreateElement("header", HTML.SetText("Choose map:"), HTML.SetStyles(s => s.marginRight = "16px")),
							HTML.CreateElement("select",
								HTML.AddEventListener("change", function (ev) {
									const select = this as HTMLSelectElement;
									processor.manager = newManager(lastGame, maps[select.value]);
								}),
								HTML.Append(...Object.keys(maps).map((name) => HTML.CreateElement("option",
									HTML.SetText(name),
									(el) => el.value = name,
								)))
							))))
				),
				canvas,
				HTML.CreateElement("section",
					HTML.SetStyles(style => {
						style.display = "flex"
						style.flexDirection = "column"
						style.justifyContent = "space-between"
					}),
					HTML.Append(keyboards.map(x => x.joystick()))
				),
			)
		)
	)
})
