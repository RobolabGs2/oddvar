import { World } from "world"
import { Point, Size } from "geometry";
import { Graphics, RectangleTexture } from "graphics/graphics";
import { Controller } from "controller";
import { Physics } from "physics/physics";
import { Parser } from "parser";
import * as HTML from "html";

/**
 * This is Oddvar
 */
export class Oddvar {
	private pause = false;
	private world = new World();
	private graphics = new Graphics(HTML.CreateElement("canvas", c => {
		c.width = 500;
		c.height = 500;
		document.body.append(c);
	}, HTML.AddEventListener("click", () => { this.pause = ! this.pause })));

	private controller = new Controller();
	private physics = new Physics();
	public constructor(worldJSON: string) {
		const parser = new Parser(
			[this.world, this.graphics, this.controller, this.physics],
			[Point, Size, RectangleTexture])
		parser.parseWorld(worldJSON);
		fetch("resources/reflection.json", {
			method: "GET",
			headers: {
				"Content-Type": "application/json"
			}
		}).
			then(response => response.json()).
			then(parser.newTypeManager.bind(parser)).
			then(x => x.FactoryListView((deadlyRecipe) => {
				const json = JSON.stringify([deadlyRecipe], undefined, 2);
				console.log(json);
				parser.parseWorld(json)
			})).
			then(HTMLElement.prototype.append.bind(document.body)).
			catch(e => console.error(e));
		let lastTime = 0;
		let Tick = (t: number) => {
			let dt = (t - lastTime) / 1000;
			lastTime = t;
			if (dt > 0.03)
				dt = 0.03;

			if (!this.pause) {
				this.physics.Tick(dt);
				this.controller.Tick(dt);
			}
			this.graphics.Tick(dt);
			requestAnimationFrame(Tick);
		};
		requestAnimationFrame(Tick);
	}
}
