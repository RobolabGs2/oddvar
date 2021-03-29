import { KeyAction, KeyInput, MessageHandler } from './protocol';
import { HTML } from '../web/html'

export interface KeyboardEvents {
	"pressKey": KeyInput
}

export type MapOfArrays<T> = {
	[K in keyof T]: T[K][]
}


export class Keyboard {
	private listeners: MapOfArrays<MessageHandler<KeyboardEvents>> = {
		pressKey: [],
	};
	constructor(private readonly keyMapping: Record<string, KeyAction> = {
		"KeyA": KeyAction.LEFT,
		"KeyD": KeyAction.RIGHT,
		"KeyW": KeyAction.UP,
		"KeyS": KeyAction.DOWN,
	}) {
		document.addEventListener("keydown", ev => {
			this.dispatchKeyInput(ev.code, "down");
		});
		document.addEventListener("keyup", ev => {
			this.dispatchKeyInput(ev.code, "up");
		});
		document.body.append(
			HTML.CreateElement("footer",
				HTML.SetStyles(style => {
					style.display = "flex";
					style.width = "500px";
				}),
				HTML.Append(...Object.values(keyMapping).map(a => {
				const action = KeyAction[a] as string;
				return HTML.CreateElement(
					"button",
					HTML.SetStyles(style => {
						style.flex= "1";
						style.height= "2em";
					}),
					HTML.SetText(action),
					HTML.AddEventListener('mousedown', (ev) => {
						ev.preventDefault();
						this.dispatchKeyCode(a, "down");
					}),
					HTML.AddEventListener('touchstart', (ev) => {
						ev.preventDefault();
						this.dispatchKeyCode(a, "down");
					}),
					HTML.AddEventListener('mouseup', (ev) => {
						ev.preventDefault();
						this.dispatchKeyCode(a, "up");
					}),
					HTML.AddEventListener('touchend', (ev) => {
						ev.preventDefault();
						this.dispatchKeyCode(a, "up");
					}))}
				))))
	}
	public addEventListener<E extends keyof KeyboardEvents>(eventType: E, listener: (ev: KeyboardEvents[E]) => void) {
		this.listeners[eventType].push(listener);
	}
	private dispatchKeyInput(keyCode: string, action: KeyInput["action"]) {
		const key = this.keyMapping[keyCode];
		if (key === undefined)
			return;
		this.dispatchKeyCode(key, action);
	}
	private dispatchKeyCode(key: KeyAction, action: KeyInput["action"]) {
		this.listeners.pressKey.forEach(l => l({ action, key: key, sync: Date.now() }));
	}
}
