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
import { CreateContext, HTML } from "../web/html";

console.log("Hello ODDVAR");

DownloadResources().then(([reflectionJSON, resources]) => {
	const canvasContext = CreateContext();
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
		"test": TestMap,
		"random maze": RandomLabirint,
		"symmetric": PacManLikeLabirint,
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
		HTML.CreateElement("footer",
			HTML.Append(...Object.entries(maps).map(([name, creator]) => HTML.CreateElement("button",
				HTML.SetText(name),
				HTML.AddEventListener("click", () => {
					processor.manager = newManager(creator);
				})
			)))
		)
	)

	// setTimeout(()=>oddvar.Die(), 1000)
})
