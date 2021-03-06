console.log("Hello");
console.log("ODDVAR");

let swprotocol = window.location.protocol == "https:" ? "wss" : "ws";
const url = `${swprotocol}://${window.location.hostname}:8999/`;
const socket = new WebSocket(url);
socket.addEventListener("open", function (e) {
    console.log("[open] Соединение установлено", e);
	socket.send("Hello server!")
});

socket.addEventListener("message", function (event) {
    const data = event.data;
    console.log(`From websocket: ${data}`)
});

socket.addEventListener("close", function (event) {
    if (event.wasClean) {
        console.log(`[close] Соединение закрыто чисто, код=${event.code} причина=${event.reason}`);
    } else {
        // например, сервер убил процесс или сеть недоступна
        // обычно в этом случае event.code 1006
        alert('[close] Соединение прервано');
        console.error(`[close] Соединение закрыто, код=${event.code} причина=${event.reason}`);
    }
});

socket.addEventListener("error", function (error) {
    alert(error);
    console.error(error);
});
