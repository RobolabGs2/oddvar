import { Processor } from "./processor";

console.log("Hello ODDVAR");
let swprotocol = window.location.protocol == "https:" ? "wss" : "ws";
const url = `${swprotocol}://${window.location.hostname}:8999/`;

getJSON("resources/reflection.json").then(reflectionJSON => {
	let processor = new Processor(new WebSocket(url), reflectionJSON);
})

function getJSON(url: string): Promise<any> {
	return fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	}).then(r => r.json())
}

// socket.addEventListener("message", function (event) {
// 	const data = event.data;
// 	console.log(`From websocket: ${data}`)
// });

// socket.addEventListener("close", function (event) {
// 	if (event.wasClean) {
// 		console.log(`[close] Соединение закрыто чисто, код=${event.code} причина=${event.reason}`);
// 	} else {
// 		// например, сервер убил процесс или сеть недоступна
// 		// обычно в этом случае event.code 1006
// 		alert('[close] Соединение прервано');
// 		console.error(`[close] Соединение закрыто, код=${event.code} причина=${event.reason}`);
// 	}
// });

// socket.addEventListener("error", function (error) {
// 	alert(error);
// 	console.error(error);
// });
