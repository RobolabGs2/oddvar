import { Processor } from "./processor";
import { DownloadResources, getJSON } from "../web/http"
import { Keyboard } from "../oddvar/input";
import { KeyAction } from "../oddvar/protocol";
import { HTML } from "../web/html";

console.log("Hello ODDVAR");
let swprotocol = window.location.protocol == "https:" ? "wss" : "ws";
const url = `${swprotocol}://${window.location.host}/api/`;

DownloadResources().then(([reflectionJSON, images]) => {

	const keyboard = new Keyboard({
		"KeyA": KeyAction.LEFT,
		"KeyD": KeyAction.RIGHT,
		"KeyW": KeyAction.UP,
		"KeyS": KeyAction.DOWN,
		"ArrowLeft": KeyAction.LEFT,
		"ArrowRight": KeyAction.RIGHT,
		"ArrowUp": KeyAction.UP,
		"ArrowDown": KeyAction.DOWN,
	})

	const canvas = HTML.CreateElement("canvas", c => {
		c.width = 500;
		c.height = 500;
		document.body.append(c);
		c.style.backgroundImage = "url(https://raw.githubusercontent.com/RobolabGs2/test-io/develop/static/img/background/0.jpg)";
	});

	const hiddenCanvas = HTML.CreateElement("canvas", c => {
		c.width = 500;
		c.height = 500;
	}).getContext("2d")!;
	const patternContext = HTML.CreateElement("canvas", c => { c.height = c.width = 500; }).getContext("2d")!;

	document.body.appendChild(
		HTML.CreateElement("article",
			HTML.Append(
				canvas,
				HTML.CreateElement("section",
					HTML.SetStyles(style => {
						style.width = "500px";
						style.display = "flex"
						style.justifyContent = "space-between"
					}),
					HTML.Append([keyboard, keyboard].map(x => x.joystick()))
				),
			)
		)
	)

	let processor = new Processor(new WebSocket(url), reflectionJSON, images, canvas.getContext("2d")!, hiddenCanvas, patternContext, keyboard);
})
