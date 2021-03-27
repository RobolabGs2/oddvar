import { Processor } from "./processor";
import { getJSON } from "../web/http";
import { World } from "../oddvar/world";
import { LocalPlayers } from "./players";
import { Physics } from "../oddvar/physics/physics";
import { Graphics } from "../oddvar/graphics";
import * as HTML from "../web/html";
import { Controller } from "../oddvar/controller";
import { TexturesManager } from "../oddvar/textures";
import { Oddvar, Worlds } from "../oddvar/oddvar";
import { Manager } from "../oddvar/manager";
import { CollectingSquaresGame } from '../games/collecting_squares';
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";

console.log("Hello ODDVAR");

getJSON("resources/reflection.json").then(reflectionJSON => {
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
		CreateGraphics(),
		new Controller(false),
		new TexturesManager())
	const oddvar = new Oddvar(worlds, reflectionJSON);
	let processor = new Processor(new Manager(oddvar, new CollectingSquaresGame(oddvar)));
})

function CreateGraphics() {
	return new Graphics(HTML.CreateElement("canvas", c => {
		c.width = 500;
		c.height = 500;
		document.body.append(c);
	}).getContext("2d")!);
}