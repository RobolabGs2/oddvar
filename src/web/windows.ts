import { Point, Size } from "../oddvar/geometry";
import { Observable } from "../oddvar/utils";
import { HTML } from "./html";

export interface TableModel<T, E extends string> extends Observable<{ updated: number }, T> {
	fields: Record<E, any>[];
}

interface MetricsTableLine {
	name: string;
	value: number;
}

export interface Ticker {
	Tick(dt: number): void;
}

export class MetricsTable extends Observable<{ updated: number }> implements TableModel<MetricsTable, keyof MetricsTableLine> {
	constructor(readonly metricsSource: () => Record<string, string | number | boolean>) {
		super();
		this.fields = this.getMetrics();
	}
	static readonly header = ["name", "value"];
	fields: MetricsTableLine[];
	Tick() {
		this.fields = this.getMetrics();
		for (let i = 0; i < this.fields.length; ++i)
			this.dispatchEvent("updated", i)
	}
	getMetrics() {
		return Object.entries(this.metricsSource()).map(([name, value]) => { return <MetricsTableLine>{ name, value } });
	}
}

export interface Logger {
	InfoLine(msg: string): void;
	WarnLine(msg: string): void;
	ErrorLine(msg: string): void;
}

export class RotatedLogs<T extends { section: HTMLElement }> {
	buffer: T[] = [];
	cur = 0;
	constructor(readonly create: () => T, readonly parent: HTMLElement, readonly cap = 100) {
		parent.style.display = "flex";
		parent.style.flexDirection = "column";
		for(let i = 0; i< cap; i++) {
			const line = (this.buffer[i] = this.create()).section;
			line.style.order = `-1`;
			this.parent.appendChild(line);
		}
	}

	insert(inserter: (line: T) => void) {
		const lineNum = this.cur;
		requestAnimationFrame(() => {
			const line = this.buffer[(lineNum) % this.cap];
			line.section.style.order = `${lineNum}`;
			inserter(line);
		})
		++this.cur;
	}
}

export class ConsoleWindow implements Logger {
	logs = new RotatedLogs<{section: HTMLElement}>(
		() => { return {section: HTML.CreateElement('div')}; },
		this.container, 1000);

	constructor(private container: HTMLElement) {
	}

	private WriteLine(msg: string, color: string) {
		this.logs.insert(line => {
			HTML.ModifyElement(line.section,
				HTML.SetText(msg),
				HTML.SetStyles(s => s.color = color))
		});
		this.container.scrollTop = this.container.scrollHeight
	}

	InfoLine(msg: string): void {
		this.WriteLine(msg, 'lime')
	}

	WarnLine(msg: string): void {
		this.WriteLine(msg, 'yellow')
	}

	ErrorLine(msg: string): void {
		this.WriteLine(msg, 'red')
	}
}

export class BarChartRow {
	constructor(public name: string, public value: number, public color: string = 'white') {
	}
}

export class BarChartWindow implements Ticker{
	lines: HTMLElement[] = []
	table: HTMLElement;
	constructor(private container: HTMLElement, private rows: BarChartRow[]) {
		this.table = HTML.CreateElement('table', HTML.SetStyles(s => {s.width = '100%'; s.height = "100%"; s.borderCollapse = "collapse"}));
		container.appendChild(this.table);
		rows.forEach(r => this._append(r));
	}

	private _append(row: BarChartRow) {
		let line;
		this.table.append(
			HTML.CreateElement('tr', HTML.SetStyles(s => {s.width = '100%';}), HTML.Append(
				HTML.CreateElement('td', HTML.SetStyles(s => s.border = '1px solid black'), HTML.SetText(row.name)),
				HTML.CreateElement('td', HTML.SetStyles(s => {s.height = `${100 / this.rows.length}%`; s.width = '100%'; s.border = '1px solid gray'}), HTML.Append(
					line = HTML.CreateElement('div',
						HTML.SetStyles(s => {
							s.backgroundColor = row.color;
							s.height = '100%';
							s.textAlign = "center";
						}), HTML.AddClass(WindowsManager.cssClasses.visibleOnAnything)
					)
				))
			))
		);
		this.lines.push(line);
	}

	append(row: BarChartRow) {
		this.rows.push(row)
		this._append(row);
	}

	Tick(dt: number): void {
		let	max = Math.max(...this.rows.map(r => r.value));

		this.lines.forEach((l, i) => {
			l.style.width = `${this.rows[i].value / max * 100}%`;
			l.textContent = this.rows[i].value.toFixed(2);
		})
	}
}

export class ChartWindow
{
	private context: CanvasRenderingContext2D;
	private last = 0;
	private first = true;
	constructor(private container: HTMLElement) {
		let canvas = HTML.CreateElement('canvas');
		container.append(canvas)
		this.context = canvas.getContext('2d')!;
		this.context.strokeStyle = "lime";
		this.context.fillStyle = "black";
	}

	public append(value: number) {
		value = this.context.canvas.height - value
		if (this.first) {
			this.first = false;
			this.last = value;
			return;
		}
		const frameWidth = this.context.canvas.width - 1;
		const frameHeight = this.context.canvas.height;
		this.context.drawImage(this.context.canvas, 1, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
		this.context.fillRect(frameWidth, 0, 10, this.context.canvas.height)
		this.context.beginPath();
		this.context.moveTo(frameWidth, this.last);
		this.context.lineTo(this.context.canvas.width, value);
		this.context.stroke();
		this.context.closePath();
		this.last = value;
	}
}


export class WindowsManager implements Ticker{
	tickers = new Array<Ticker>();

	public static readonly cssClasses = {
		visibleOnAnything: "visible-on-anything"
	}

	constructor(readonly container: HTMLElement, styleSheet: CSSStyleSheet) {
		const containerClass = "windows-container" + Math.random().toString().slice(2);
		container.classList.add(containerClass);
		styleSheet.addRule(`.${containerClass} > article`, `
			position: absolute;
			border: double 5px gray;
			border-radius: 5px;
			background-color: rgba(255, 255, 255, 0.9);
			font-family: "Bitstream Vera Sans Mono", monospace;
			font-size: 12px;
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
			width: 18px;
		`);
		styleSheet.addRule(`.${containerClass} > article > header button:focus`, `
			outline: none;
		`);
		styleSheet.addRule(`.${containerClass} > article > section .table`, `
			display: flex;
			flex-direction: column;
		`);
		styleSheet.addRule(`.${containerClass} > article > section .table > section`, `
			display: flex;
			justify-content: space-between;
			border-top: solid 1px gray;
		`);
		styleSheet.addRule(`.${containerClass} > article > section .${WindowsManager.cssClasses.visibleOnAnything}`, `
			font-weight: bold;
			text-shadow: #000 1px 0 0px, #000 0 1px 0px, #000 -1px 0 0px, #000 0 -1px 0px;
			color: white;
		`);
	}

	public Tick(dt: number) {
		this.tickers.forEach(t => t.Tick(dt))
	}

	public NewCreateBarChartWindow(title: string, rows: BarChartRow[], size: Size = new Size(50, 30)): [HTMLElement, BarChartWindow] {
		const container = HTML.CreateElement('div', HTML.SetStyles(s =>{
			s.width = `${size.width}rem`;
			s.height = `${size.height}rem`;
			s.overflow = 'auto'
			s.color = 'rgb(250, 250, 250)'
			s.backgroundColor = 'black';
			s.display = 'table';
		}))
		const barChart = new BarChartWindow(container, rows)
		this.tickers.push(barChart);
		return [container, barChart];
	}

	public CreateBarChartWindow(title: string, rows: BarChartRow[], position = Point.Zero, size: Size = new Size(50, 30)): BarChartWindow {
		const pair = this.NewCreateBarChartWindow(title, rows, size);
		this.CreateInfoWindow(title, pair[0], position);
		return pair[1];
	}

	CreateConsoleWindow(title: string, position = Point.Zero, size: Size = new Size(50, 30)): ConsoleWindow {
		const container = HTML.CreateElement('div', HTML.SetStyles(s =>{
			s.whiteSpace = 'pre';
			s.width = `${size.width.toString()}rem`;
			s.height = `${size.height.toString()}rem`;
			s.overflow = 'auto'
			s.color = 'lime'
			s.backgroundColor = 'black'
		}))
		const window = new ConsoleWindow(container)
		this.CreateInfoWindow(title, container, position)
		return window;
	}

	CreateChartWindow(title: string, position = Point.Zero, size: Size = new Size(50, 30)): ChartWindow {
		const container = HTML.CreateElement('div', HTML.SetStyles(s =>{
			s.whiteSpace = 'pre';
			s.width = `${size.width.toString()}rem`;
			s.height = `${size.height.toString()}rem`;
			s.overflow = 'auto'
			s.color = 'lime'
			s.backgroundColor = 'black'
		}))
		const chart = new ChartWindow(container)
		this.CreateInfoWindow(title, container, position)
		return chart;
	}

	CreateInfoWindow(title: string, content: HTMLElement, position = Point.Zero) {
		this.container.appendChild(this.CreateWindow(title, content, position));
	}

	CreateTableWindow<T, K extends string>(title: string, table: TableModel<T, K>,
		header: K[], pos = Point.Zero, lineStyles: ((style: CSSStyleDeclaration) => void)[] = []) {
		this.container.appendChild(this.CreateWindow(title, this.CreateTable(table, header, lineStyles), pos))
	}

	public CreateTable<T, K extends string>(table: TableModel<T, K>, header: K[], lineStyles: ((style: CSSStyleDeclaration) => void)[] = []) {
		const lines = table.fields.map((line) => header.map(name => HTML.CreateElement("span", HTML.SetText(`${line[name]}`))));
		table.addEventListener("updated", i => lines[i].forEach((cell, j) => HTML.SetText(`${table.fields[i][header[j]]}`)(cell)))
		return HTML.CreateElement("article", HTML.AddClass("table"),
			HTML.Append(lines.map((view, i) => HTML.CreateElement("section", HTML.Append(view), HTML.SetStyles(lineStyles[i] || (() => { }))))),
			table => {
				if (lineStyles.length)
					table.classList.add(WindowsManager.cssClasses.visibleOnAnything);
			}
		);
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
		};
		const mouseMove = function (ev: MouseEvent): void {
			onMove(new Point(ev.pageX, ev.pageY), window);
		};

		const hideButton = HTML.CreateElement("button", HTML.SetText("🗕"))
		const hide = () => {
			const wasHide = content.style.display === "none";
			content.style.display = wasHide ? "" : "none";
			hideButton.innerText = wasHide ? "🗕" : "🗖";
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
