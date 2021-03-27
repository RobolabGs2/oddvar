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
import { CollectingSquaresGame } from '../games/collecting_squares';
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";
import { CreateContext } from "../web/html";

console.log("Hello ODDVAR");

DownloadResources().then(([reflectionJSON, resources]) => {
	const canvasContext = CreateContext();
	const worlds = new Worlds(
		new World(),
		new LocalPlayers([
			new Keyboard(),
			new Keyboard({
				"ArrowLeft": KeyAction.LEFT,
				"ArrowRight": KeyAction.RIGHT,
				"ArrowUp": KeyAction.UP,
				"ArrowDown": KeyAction.DOWN,
			})
		]),
		new Physics(),
		new Graphics(canvasContext),
		new Controller(false),
		new TexturesManager(resources, canvasContext))
	const oddvar = new Oddvar(worlds, reflectionJSON);
	let processor = new Processor(new Manager(oddvar, new CollectingSquaresGame(oddvar)));
})