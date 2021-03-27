import { Processor } from "./processor";
import { DownloadResources, getJSON } from "../web/http"

console.log("Hello ODDVAR");
let swprotocol = window.location.protocol == "https:" ? "wss" : "ws";
const url = `${swprotocol}://${window.location.hostname}:8999/`;

DownloadResources().then(([reflectionJSON, images]) => {
	let processor = new Processor(new WebSocket(url), reflectionJSON, images);
})
