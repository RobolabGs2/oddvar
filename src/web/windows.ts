import { Point } from "../oddvar/geometry";
import { Observable } from "../oddvar/utils";
import { HTML } from "./html";

export interface TableModel<T, E extends string> extends Observable<{ updated: number }, T> {
	fields: Record<E, any>[];
}

export class WindowsManager {
	constructor(readonly container: HTMLElement, styleSheet: CSSStyleSheet) {
		const containerClass = "windows-container";
		container.classList.add(containerClass);
		styleSheet.addRule(`.${containerClass} > article`, `
			position: absolute;
			border: double 5px gray;
			border-radius: 5px;
			background-color: rgba(250, 250, 250, 0.6);
		`);
		styleSheet.addRule(`.${containerClass} > article > header`, `
			border-bottom: solid 1px gray;
			display: flex;
			height: 1.3em;
			padding-left: 4px;
		`);
		styleSheet.addRule(`.${containerClass} > article > header button`, `
			border: none;
			border-left: solid 1px gray;
			margin: 0;
			height: 100%;
		`);
		styleSheet.addRule(`.${containerClass} > article > section > .table`, `
			display: flex;
			flex-direction: column;
		`);
		styleSheet.addRule(`.${containerClass} > article > section > .table > section `, `
			display: flex;
			justify-content: space-between;
			border-top: solid 1px gray;
		`);
	}

	CreateInfoWindow(title: string, content: HTMLElement, position = Point.Zero) {
		this.container.appendChild(this.CreateWindow(title, content, position));
	}

	CreateTableWindow<T, K extends string>(title: string, table: TableModel<T, K>,
		header: K[], lineStyles: ((style: CSSStyleDeclaration) => void)[] = []) {
		const lines = table.fields.map((line) => header.map(name => HTML.CreateElement("span", HTML.SetText(`${line[name]}`))));
		table.addEventListener("updated", i => lines[i].forEach((cell, j) => HTML.SetText(`${table.fields[i][header[j]]}`)(cell)))
		this.container.appendChild(this.CreateWindow(title, HTML.CreateElement("article",
			HTML.AddClass("table"),
			HTML.Append(lines.map((view, i) => HTML.CreateElement("section", HTML.Append(view), HTML.SetStyles(lineStyles[i] || (() => { })))))
		)))
	}

	private CreateWindow(title: string, inner: HTMLElement, defaultPosition = Point.Zero): HTMLElement {
		const window = HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.left = `${defaultPosition.x}px`;
				style.top = `${defaultPosition.y}px`;
			}))
		const content = HTML.CreateElement("section", HTML.Append(inner));
		return HTML.ModifyElement(window,
			HTML.Append(
				this.CreateHeader(title, window, content),
				content
			)
		)
	}

	private CreateHeader(title: string, window: HTMLElement, content: HTMLElement): HTMLElement {
		let pos: Point | null;
		let startPos: Point | null;
		const onMove = (next: Point, elem: HTMLElement) => {
			if (pos == null || startPos == null)
				return;
			const delta = next.Sub(pos);
			elem.style.left = `${startPos.x + delta.x}px`;
			elem.style.top = `${startPos.y + delta.y}px`;
		}
		const mouseMove = function (ev: MouseEvent): void {
			onMove(new Point(ev.pageX, ev.pageY), window);
		};

		const hideButton = HTML.CreateElement("button", HTML.SetText("🗕"))
		const hide = () => {
			const wasHide = content.style.display === "none";
			content.style.display = wasHide ? "" : "none";
			hideButton.innerText = wasHide ? "🗖" : "🗕";
		};
		return HTML.CreateElement("header",
			HTML.AddEventListener("dblclick", hide),
			HTML.Append(
				HTML.CreateElement("header", HTML.SetText(title)),
				HTML.CreateElement("section",
					HTML.SetStyles(style => { style.cursor = "move"; style.flex = "1"; style.minWidth = "64px" }),
					HTML.AddEventListener("mousedown", function (ev) {
						if (ev.target !== this) return;
						ev.preventDefault();
						const rect = window.getBoundingClientRect();
						pos = new Point(ev.pageX, ev.pageY);
						startPos = new Point(rect.x, rect.y);
						document.addEventListener("mousemove", mouseMove)
					}),
					HTML.AddEventListener("mouseup", function (ev) {
						if (ev.target !== this) return;
						ev.preventDefault();
						document.removeEventListener("mousemove", mouseMove)
						pos = startPos = null;
					}),
				),
				HTML.CreateElement("section",
					HTML.Append(
						HTML.ModifyElement(hideButton, HTML.AddEventListener("click", hide))
						// HTML.CreateElement("button", HTML.SetText("X"), (el) => el.disabled = true)
					)),
			)
		);
	}
}
