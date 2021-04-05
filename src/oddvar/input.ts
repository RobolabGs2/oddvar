import { KeyAction, KeyInput, MessageHandler } from './protocol';
import { HTML } from '../web/html'
import { Point } from './geometry';

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

	public joystick(): HTMLElement {
		return joystick(this.dispatchKeyCode.bind(this));
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


function joystick(listener: (key: KeyAction, state: "up" | "down") => void) {
	let pos: Point | null = null;
	let pressedKeys: Set<KeyAction> = new Set();
	const unpressKey = (...keys: KeyAction[]) => {
		keys.forEach(key => {
			if (pressedKeys.delete(key)) {
				listener(key, "up")
			}
		})
	}
	const pressKey = (key: KeyAction, antagonist: KeyAction) => {
		if (!pressedKeys.has(key)) {
			listener(key, "down");
			pressedKeys.add(key);
			unpressKey(antagonist);
		}
	}
	const centerSize = 50;
	const backSize = 256;
	const borderWidth = 6;
	const offset = (backSize - centerSize) / 2 - borderWidth;
	const joystickView = HTML.CreateElement("div",
		HTML.SetStyles(joystickStyle(centerSize)),
		HTML.SetStyles(style => {
			style.position = "relative";
			style.left = style.top = `${offset}px`;
		})
	);
	const deathZone = 5;
	const onMove = (next: Point) => {
		if (pos == null)
			return
		const delta = next.Sub(pos);

		delta.x = Math.max(Math.min(delta.x, offset), -offset)
		joystickView.style.left = `${offset + delta.x}px`;
		checkDirection(delta.x, KeyAction.LEFT, KeyAction.RIGHT);

		delta.y = Math.max(Math.min(delta.y, offset), -offset)
		joystickView.style.top = `${offset + delta.y}px`;
		checkDirection(delta.y, KeyAction.UP, KeyAction.DOWN);
	}
	const freeKeys = () => {
		pressedKeys.forEach(key => listener(key, "up"))
		pressedKeys.clear();
		pos = null;
		joystickView.style.left = joystickView.style.top = `${offset}px`;
	}
	return HTML.CreateElement("div",
		HTML.SetStyles(joystickStyle(backSize)),
		HTML.AddEventListener("mousedown", function (ev) {
			ev.preventDefault();
			const rect = this.getBoundingClientRect();
			pos = new Point(rect.x + this.clientWidth / 2, rect.y + this.clientHeight / 2);
			onMove(new Point(ev.pageX, ev.pageY));
		}),
		HTML.AddEventListener("mousemove", function (ev) {
			ev.preventDefault();
			onMove(new Point(ev.pageX, ev.pageY));
		}),
		HTML.AddEventListener("mouseup", (ev) => {
			ev.preventDefault();
			freeKeys();
		}),
		HTML.Append(joystickView)
	);

	function checkDirection(delta: number, up: KeyAction, down: KeyAction) {
		if (delta > deathZone) {
			pressKey(down, up);
		} else if (delta < -deathZone) {
			pressKey(up, down);
		} else {
			unpressKey(up, down);
		}
	}

	function joystickStyle(diameter: number): (styles: CSSStyleDeclaration) => void {
		return style => {
			style.backgroundImage = `url("resources/img/joystick.png")`;
			style.backgroundSize = "cover";
			style.width = `${diameter}px`;
			style.height = `${diameter}px`;
			style.borderRadius = "50%";
			style.border = `${borderWidth}px double silver`;
		};
	}
}
