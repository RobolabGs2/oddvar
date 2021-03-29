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
import { CollectingSquaresGame, MapCreator, PacManLikeLabirint, RandomLabirint, TestMap } from '../games/collecting_squares';
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";
import { HTML } from "../web/html";

console.log("Hello ODDVAR");

DownloadResources().then(([reflectionJSON, resources]) => {
	const canvas = HTML.CreateElement("canvas", c => {
		c.width = 500;
		c.height = 500;
		document.body.append(c);
		c.style.backgroundImage = "url(https://raw.githubusercontent.com/RobolabGs2/test-io/develop/static/img/background/0.jpg)";
	});
	const canvasContext = canvas.getContext("2d")!;

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
		"symmetric": PacManLikeLabirint,
		"test": TestMap,
		"random maze": RandomLabirint,
	}

	const newManager = (map: MapCreator) => {
		const worlds = new Worlds(
			new World(),
			new LocalPlayers(keyboards),
			new Physics(),
			new Graphics(canvasContext),
			new Controller(false),
			new TexturesManager(resources, canvasContext))
		const oddvar = new Oddvar(worlds, reflectionJSON);
		return new Manager(oddvar, new CollectingSquaresGame(oddvar, map));
	}
	const processor = new Processor(newManager(PacManLikeLabirint));
	document.body.appendChild(
		HTML.CreateElement("article",
			HTML.Append(
				HTML.CreateElement("header",
					HTML.SetStyles(style => {
						style.width = "500px";
						style.display = "flex"
						style.flexDirection = "row"
						style.justifyContent = "flex-end"
					}),
					HTML.Append(
						HTML.CreateElement("header", HTML.SetText("Choose map:"), HTML.SetStyles(s => s.marginRight = "16px")),
						HTML.CreateElement("select",
							HTML.AddEventListener("change", function (ev) {
								const select = this as HTMLSelectElement;
								processor.manager = newManager(maps[select.value]);
							}),
							HTML.Append(...Object.keys(maps).map((name) => HTML.CreateElement("option",
								HTML.SetText(name),
								(el) => el.value = name,
							)))
						)
					)
				),
				canvas,
				HTML.CreateElement("section",
					HTML.SetStyles(style => {
						style.width = "500px";
						style.display = "flex"
						style.justifyContent = "space-between"
					}),
					HTML.Append(keyboards.map(x => x.joystick()))
				),
			)
		)
	)
})
