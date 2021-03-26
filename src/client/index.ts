import { Processor } from "./processor";
import { getJSON } from "../web/http"

console.log("Hello ODDVAR");
let swprotocol = window.location.protocol == "https:" ? "wss" : "ws";
const url = `${swprotocol}://${window.location.hostname}:8999/`;

getJSON("resources/reflection.json").then(reflectionJSON => {
	let processor = new Processor(new WebSocket(url), reflectionJSON);
})
