import { Point, Size } from "../oddvar/geometry";
import { ConvertRecord, Observable } from "../oddvar/utils";
import { LoggerLevel, Logger } from "../oddvar/utils/logger";
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

export class RotatedLogs<T extends { section: HTMLElement } = { section: HTMLElement }> {
	private buffer: T[] = [];
	private cur = 0;
	constructor(readonly create: () => T, readonly parent: HTMLElement, readonly cap = 100) {
		parent.style.overflow = "auto";
		for (let i = 0; i < cap; i++) {
			const line = (this.buffer[i] = this.create()).section;
			this.parent.appendChild(line);
		}
	}

	insert(inserter: (line: T) => void) {
		const line = this.buffer[(this.cur++) % this.cap];
		this.parent.appendChild(line.section)
		inserter(line);
	}
}

export class ConsoleWindow<MsgType extends string> {
	logs: Record<MsgType, RotatedLogs>;
	constructor(private logsContainer: HTMLElement, msgTypes: MsgType[]) {
		this.logs = msgTypes.reduce((acc, value) => {
			acc[value] = new RotatedLogs(() => { return { section: <HTMLElement>HTML.CreateElement('div', HTML.AddClass(value)) }; }, this.logsContainer, (1000 / msgTypes.length) | 0);
			return acc;
		}, {} as Record<MsgType, RotatedLogs>);
	}

	buffer = new Array<[string, MsgType]>()

	public WriteLine(lvl: MsgType, msg: string) {
		this.buffer.push([msg, lvl])
	}

	Tick(dt: number) {
		if (this.buffer.length) {
			this.buffer.forEach(([msg, lvl]) => this.logs[lvl].insert(line => line.section.textContent = msg));
			this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
			this.buffer.length = 0;
		}
	}
}

export class BarChartRow {
	constructor(public name: string, public value: number, public color: string = 'white') {
	}
}

export class BarChartWindow implements Ticker {
	lines: HTMLElement[] = []
	table: HTMLElement;
	constructor(container: HTMLElement, private rows: BarChartRow[]) {
		this.table = HTML.CreateElement('table', HTML.SetStyles(s => { s.width = '100%'; s.height = "100%"; s.borderCollapse = "collapse" }));
		container.appendChild(this.table);
		rows.forEach(r => this._append(r));
	}

	private _append(row: BarChartRow) {
		let line;
		this.table.append(
			HTML.CreateElement('tr', HTML.SetStyles(s => { s.width = '100%'; }), HTML.Append(
				HTML.CreateElement('td', HTML.SetStyles(s => s.border = '1px solid black'), HTML.SetText(row.name)),
				HTML.CreateElement('td', HTML.SetStyles(s => { s.height = `${100 / this.rows.length}%`; s.width = '100%'; s.border = '1px solid gray' }), HTML.Append(
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
		let max = Math.max(...this.rows.map(r => r.value));

		this.lines.forEach((l, i) => {
			l.style.width = `${this.rows[i].value / max * 100}%`;
			l.textContent = this.rows[i].value.toFixed(2);
		})
	}
}

export class ChartWindow {
	private context: CanvasRenderingContext2D;
	private last = 0;
	private first = true;
	constructor(container: HTMLElement) {
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

export class StyleSheetTree {
	private rules = new Set<CSSRule>();
	private childs = new Array<StyleSheetTree>();
	constructor(private readonly styleSheet: CSSStyleSheet, readonly selector: string = "") { }

	addRule(selector: string, style: string = ''): CSSStyleRule {
		const index = this.styleSheet.insertRule(`${this.selector} ${selector} {${style}}`, this.styleSheet.rules.length);
		const rule = this.styleSheet.cssRules[index];
		this.rules.add(rule);
		return rule as CSSStyleRule;
	}

	chainAddRule(selector: string, style: string = ''): this {
		this.addRule(selector, style);
		return this;
	}

	deleteRule(rule: CSSStyleRule): void {
		if (!this.rules.has(rule))
			throw new RangeError(`Try remove rule '${rule.cssText}' from incorrect sheet`);
		this.rules.delete(rule);
		for (let i = 0; i < this.styleSheet.cssRules.length; i++) {
			if (this.styleSheet.cssRules.item(i) === rule) {
				this.styleSheet.removeRule(i);
				return;
			}
		}
		throw new RangeError(`Can't remove rule ${rule.cssText}`);
	}

	child(selector: string): StyleSheetTree {
		const sheet = new StyleSheetTree(this.styleSheet, `${this.selector} ${selector}`);
		this.childs.push(sheet);
		return sheet;
	}

	Dispose(cascade = true) {
		if (cascade) {
			this.childs.forEach(child => child.Dispose());
			this.childs.length = 0;
		}
		for (let i = this.styleSheet.cssRules.length - 1; i >= 0; i--) {
			if (this.rules.has(this.styleSheet.cssRules.item(i)!)) {
				this.styleSheet.removeRule(i);
			}
		}
	}
}

export function CSSColors<T extends string | number>(colorsSettings: Record<T, string>): Record<T, Partial<CSSStyleDeclaration>> {
	return ConvertRecord(colorsSettings, (key, color) => { return { color } })
}

export class WindowsManager implements Ticker {
	tickers = new Array<Ticker>();
	disposes = new Array<{ Dispose: () => void }>();
	public static readonly cssClasses = {
		visibleOnAnything: "visible-on-anything"
	}

	private windowCSS: StyleSheetTree
	private headerCSS: StyleSheetTree
	private contentCSS: StyleSheetTree

	constructor(readonly container: HTMLElement, styleSheet: StyleSheetTree) {
		const containerClass = "windows-container" + Math.random().toString().slice(2);
		container.classList.add(containerClass);
		this.windowCSS = styleSheet.child(`.${containerClass} > article`);
		this.headerCSS = this.windowCSS.child(`> header`);
		this.contentCSS = this.windowCSS.child(`> section`);
		this.windowCSS.addRule('', `
			position: absolute;
			border: double 5px gray;
			border-radius: 5px;
			background-color: rgba(255, 255, 255, 0.9);
			font-family: "Bitstream Vera Sans Mono", monospace;
			font-size: 12px;
		`);
		this.headerCSS.addRule(``, `
			border-bottom: solid 1px gray;
			display: flex;
			height: 1.3em;
			padding-left: 4px;
		`);
		this.headerCSS.addRule(`button`, `
			border: none;
			border-left: solid 1px gray;
			margin: 0;
			height: 100%;
			width: 18px;
		`);
		this.headerCSS.addRule(`button:focus`, `
			outline: none;
		`);
		this.contentCSS.child(".table").
			chainAddRule('', `
				display: table;
				border-collapse: collapse;
				width: 100%;
				height: 100%;
			`).chainAddRule(`td`, `
				border-top: solid 1px gray;
				padding-top: 4px;
				padding-left: 8px;
				padding-right: 8px;
			`).chainAddRule(`td:first-child`, `
				padding-right: 16px;
				padding-left: 0px;
			`).chainAddRule(`td:last-child`, `
				padding-right: 0px;
				padding-left: 16px;
			`);
		this.contentCSS.addRule('*', `max-height: 80vh`)
		this.contentCSS.addRule(`.${WindowsManager.cssClasses.visibleOnAnything}`, `
			font-weight: bold;
			text-shadow: #000 1px 0 0px, #000 0 1px 0px, #000 -1px 0 0px, #000 0 -1px 0px;
			color: white;
		`);
	}

	public Tick(dt: number) {
		this.tickers.forEach(t => t.Tick(dt))
	}

	public Dispose() {
		this.tickers.length = 0;
		this.disposes.forEach(d => d.Dispose());
		this.disposes.length = 0;
		this.container.innerHTML = "";
	}

	public NewCreateBarChartWindow(rows: BarChartRow[], size: Size = new Size(50, 30)): [HTMLElement, BarChartWindow] {
		const container = HTML.CreateElement('div', HTML.SetStyles(s => {
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
		const pair = this.NewCreateBarChartWindow(rows, size);
		this.CreateInfoWindow(title, pair[0], position);
		return pair[1];
	}

	CreateLoggerWindow(title: string, position = Point.Zero, size: Size = new Size(50, 30)): Logger {
		const console = this.CreateConsoleWindow<LoggerLevel>(title, position, size,
			CSSColors({
				TRACE: "white",
				DEBUG: "cyan",
				INFO: "lime",
				WARN: "yellow",
				ERROR: "red",
			}));
		return new Logger("TRACE", "", console.WriteLine.bind(console));
	}

	CreateConsoleWindow<MsgTypes extends string>(title: string, position = Point.Zero, size: Size = new Size(50, 30),
		settings: Record<MsgTypes, Partial<CSSStyleDeclaration>>): ConsoleWindow<MsgTypes> {
		const styleSheet = this.contentCSS.child("> article");
		Object.entries<Partial<CSSStyleDeclaration>>(settings).forEach(([type, style]) => {
			const rule = styleSheet.addRule(`.${type}`);
			for (let x in style) {
				const value = style[x];
				if (value)
					rule.style[x] = value;
			}
		});
		this.disposes.push(styleSheet);
		const container = HTML.CreateElement('div', HTML.SetStyles(s => {
			s.overflow = 'auto'
		}))
		const window = new ConsoleWindow<MsgTypes>(container, Object.keys(settings) as MsgTypes[]);
		this.tickers.push(window);
		this.CreateInfoWindow(title, HTML.CreateElement("article", HTML.FlexContainer("column"),
			HTML.SetStyles(s => {
				s.whiteSpace = 'pre';
				s.width = `${size.width}rem`;
				s.height = `${size.height}rem`;
				s.color = 'lime'
				s.backgroundColor = 'black'
			}),
			HTML.Append(
				HTML.CreateElement("footer", HTML.FlexContainer("row", "space-between", { wrap: true }), HTML.Append(
					Object.keys(settings).map(lvl => {
						const selector = `div.${lvl}`;
						const rule = styleSheet.addRule(selector);
						return HTML.CreateElement("section", HTML.Append(
							HTML.CreateElement("input", HTML.SetInputType("checkbox"), HTML.AddClass(lvl), HTML.SetChecked(),
								HTML.AddEventListener("change", function () {
									rule.style.display = (<HTMLInputElement>this).checked ? "" : "none";
								})),
							HTML.CreateElement("span", HTML.SetText(lvl), HTML.AddClass(lvl)),
						))
					})
				)), container
			)), position)
		return window;
	}

	CreateChartWindow(title: string, position = Point.Zero, size: Size = new Size(50, 30)): ChartWindow {
		const container = HTML.CreateElement('div', HTML.SetStyles(s => {
			s.whiteSpace = 'pre';
			s.width = `${size.width}rem`;
			s.height = `${size.height}rem`;
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

	CreateCloseableWindow(title: string, content: HTMLElement, position = new Point(document.body.clientWidth / 3, document.body.clientHeight / 3)) {
		const window = this.CreateWindow(title, content, position, true);
		this.container.appendChild(window);
		const close = () => this.container.removeChild(window);
		return { close };
	}

	CreateTableWindow<T, K extends string>(title: string, table: TableModel<T, K>,
		header: K[], pos = Point.Zero, lineStyles: ((style: CSSStyleDeclaration) => void)[] = []) {
		this.container.appendChild(this.CreateWindow(title, this.CreateTable(table, header, lineStyles), pos))
	}

	public CreateTable<T, K extends string>(table: TableModel<T, K>, header: K[], lineStyles: ((style: CSSStyleDeclaration) => void)[] = []) {
		const lines = table.fields.map((line) => header.map(name => HTML.CreateElement("td", HTML.SetText(`${line[name]}`))));
		const bufferSet = new Set<number>();
		table.addEventListener("updated", i => bufferSet.add(i))
		this.tickers.push({
			Tick: () => {
				bufferSet.forEach(i => lines[i].forEach((cell, j) => cell.textContent = `${table.fields[i][header[j]]}`));
				bufferSet.clear;
			}
		})
		return HTML.CreateElement("article", HTML.AddClass("table"),
			HTML.Append(lines.map((view, i) => HTML.CreateElement("tr", HTML.Append(view), HTML.SetStyles(lineStyles[i] || (() => { }))))),
			table => {
				if (lineStyles.length)
					table.classList.add(WindowsManager.cssClasses.visibleOnAnything);
			}
		);
	}

	private CreateWindow(title: string, inner: HTMLElement, defaultPosition = Point.Zero, closeable = false): HTMLElement {
		const window = HTML.CreateElement("article",
			HTML.SetStyles(style => {
				style.left = `${defaultPosition.x}px`;
				style.top = `${defaultPosition.y}px`;
			}))
		const content = HTML.CreateElement("section", HTML.Append(inner));
		return HTML.ModifyElement(window,
			HTML.Append(this.CreateHeader(title, window, content, closeable), content)
		)
	}

	private CreateHeader(title: string, window: HTMLElement, content: HTMLElement, closeable = false): HTMLElement {
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

		return HTML.CreateElement("header",
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
						HTML.CreateSwitcher(() => content.style.display !== "none", (open) => content.style.display = open ? "" : "none", { on: "🗖", off: "🗕" }),
						closeable ? HTML.CreateElement("button", HTML.SetText("X"), HTML.AddEventListener("click", () => {
							this.container.removeChild(window);
						})) : []
					)),
			)
		);
	}
}