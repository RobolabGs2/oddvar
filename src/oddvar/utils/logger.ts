const LoggerLevels = {
	TRACE: 0,
	DEBUG: 1,
	INFO: 2,
	WARN: 3,
	ERROR: 4,
};

export type LoggerLevel = keyof typeof LoggerLevels

export class Logger {
	constructor(public level: LoggerLevel = "TRACE", public prefix = "", private writer: (lvl: LoggerLevel, msg: string) => void = Logger.BrowserConsole) { }

	LevelLine(lvl: LoggerLevel, msg: string) {
		if (LoggerLevels[lvl] < LoggerLevels[this.level])
			return;
		this.writer(lvl, this.prefix + msg);
	}

	TraceLine(msg: string) { this.LevelLine("TRACE", msg) }
	DebugLine(msg: string) { this.LevelLine("DEBUG", msg) }
	InfoLine(msg: string) { this.LevelLine("INFO", msg) }
	WarnLine(msg: string) { this.LevelLine("WARN", msg) }
	ErrorLine(msg: string) { this.LevelLine("ERROR", msg) }

	private static readonly consoleLevelsMapping: Record<LoggerLevel, keyof Console> = {
		TRACE: "log",
		DEBUG: "log",
		INFO: "info",
		WARN: "warn",
		ERROR: "error",
	}
	public static BrowserConsole(lvl: LoggerLevel, msg: string): void {
		console[Logger.consoleLevelsMapping[lvl]].call(console, msg);
	}
}