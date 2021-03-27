import { KeyAction, KeyInput, MessageHandler } from './protocol';

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
	}
	public addEventListener<E extends keyof KeyboardEvents>(eventType: E, listener: (ev: KeyboardEvents[E]) => void) {
		this.listeners[eventType].push(listener);
	}
	private dispatchKeyInput(keyCode: string, action: KeyInput["action"]) {
		const key = this.keyMapping[keyCode];
		if (key === undefined)
			return;
		this.listeners.pressKey.forEach(l => l({ action, key, sync: Date.now() }));
	}
}
