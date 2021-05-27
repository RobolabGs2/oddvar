import * as fs from "fs";


export interface Metrics {
	settings: MetricSettings;
	timings: Timings;
	simulation: Simulation;
}

export interface MetricSettings {
	simulationID: SimulationID;
	simulator: Simulator;
	settings: SettingsSettings;
	mapID: MapID;
	deadline: number;
	label: string;
}

export enum MapID {
	Symmetric = "symmetric",
}

export interface SettingsSettings {
	bots: Record<string, number>;
	strategies: Record<Evaluator | Sender, any>;
	debug: boolean;
}

export enum SimulationID {
	Multiagent = "multiagent",
}

export interface Simulator {
	name: SimulatorName;
}

export enum SimulatorName {
	СимуляцияСКучейАгентов = "Симуляция с кучей агентов",
}

export interface Simulation {
	score: Score[];
}

export interface Score {
	name: ScoreName;
	score: number;
	evaluator: Evaluator;
	sender: Sender;
}

export enum Evaluator {
	Доверчивый = "Доверчивый",
	Параноик = "Параноик",
	Скептик = "Скептик",
}

export enum ScoreName {
	Bot0 = "Bot 0",
	Bot1 = "Bot 1",
	Bot10 = "Bot 10",
	Bot11 = "Bot 11",
	Bot2 = "Bot 2",
	Bot3 = "Bot 3",
	Bot4 = "Bot 4",
	Bot5 = "Bot 5",
	Bot6 = "Bot 6",
	Bot7 = "Bot 7",
	Bot8 = "Bot 8",
	Bot9 = "Bot 9",
}

export enum Sender {
	Лжец = "Лжец",
	Честный = "Честный",
}

export interface Timings {
	FPS: number;
	SPF: number;
	TPS: number;
	SPT: number;
	Time: number;
}

function scoreSorter(s1: Score, s2: Score): number {
	return Number(s1.name.substr(4)) - Number(s2.name.substr(4))
}

function ObjectFromEntries<T1 extends string | number, T2>(entries: [T1, T2][]): Record<T1, T2> {
	return entries.reduce((acc, entry) => { acc[entry[0]] = entry[1]; return acc }, {} as Record<T1, T2>);
}

// const metrics = JSON.parse(fs.readFileSync("oddvar_12bots_10min.json").toString("utf-8")) as Metrics[];
// const botsTable = ObjectFromEntries(metrics[0].simulation.score.map(bot => [bot.name, {
// 	score: new Array(metrics.length).fill(0), evaluator: bot.evaluator, sender: bot.sender, name: bot.name
// }])) as Record<ScoreName, { score: number[], evaluator: Evaluator, sender: Sender, name: ScoreName }>;
// metrics.forEach((metric, i) => metric.simulation.score.forEach(bot => botsTable[bot.name].score[i] += bot.score));

// const botsTable = ObjectFromEntries(metrics[0].simulation.score.map(({ sender, evaluator }) => [`${sender}_${evaluator}`, {
// 	score: new Array(metrics.length).fill(0), evaluator: evaluator, sender: sender
// }])) as Record<string, { score: number[], evaluator: Evaluator, sender: Sender }>;
// metrics.forEach((metric, i) => metric.simulation.score.forEach(bot => botsTable[`${bot.sender}_${bot.evaluator}`].score[i] += bot.score));


interface Launch {
	simulation: Simulation;
	timings: Timings;
}

interface LaunchesGroup {
	launches: Launch[];
	settings: MetricSettings
}

function StrategyName(bot: Score): string {
	return `${bot.sender}_${bot.evaluator}`;
}

function getOrPut<K extends string | number | symbol, T>(from: Record<K, T>, key: K, defaultValue: T): T {
	const value = from[key];
	if (value !== undefined)
		return value;
	return from[key] = defaultValue;
}

function GroupBy<T, K extends string | number | symbol>(arr: T[], toKey: (elem: T, i: number, array: T[]) => K): Record<K, T[]> {
	return arr.reduce((acc, value, i, arr) => (getOrPut(acc, toKey(value, i, arr), []).push(value), acc), {} as Record<K, T[]>)
}

export function ConvertRecord<T1, T2, Keys extends number | string>(a: Record<Keys, T1>, mapper: (origin: T1, key: Keys) => T2): Record<Keys, T2> {
	return ObjectFromEntries(Object.entries(a).map(([k, f]) => [k, mapper(f as T1, k as Keys)])) as Record<Keys, T2>;
}

function CalcStatisticStaff(value: number, avg: number) {
	const deviation = value - avg;
	const deviation2 = deviation * deviation;

	return { value, deviation, deviation2 }
}

interface StatisticType extends Record<string, number | StatisticType> { }

// Сохраняются только числовые поля
function DeepSum<T>(a: T, b: T): T {
	return ObjectFromEntries(Object.entries(a).filter(([k, v]) => typeof v === "number" || (typeof v === "object" && v !== null)).
		map(([k, v]) => [k, typeof v === "number" ? v + (<any>b)[k] : DeepSum(v, (<any>b)[k])])) as T
}

function DeepAvgBySum<T>(sum: T, count: number): T {
	if (sum === null || sum === undefined)
		return undefined as any as T;
	return ConvertRecord(<any>sum as StatisticType,
		(value) => typeof value === "object" ? DeepAvgBySum(value, count) : value / count) as any as T;
}

function DeepAvgs<T>(elems: T[]): T {
	return DeepAvgBySum(elems.reduce(DeepSum), elems.length);
}

function DeepDeviation<T>(elems: T[]): T {
	return DeepAvgBySum(elems.reduce(DeepSum), elems.length);
}

function NormilizeLaunch(launch: Launch) {
	const totalScore = launch.simulation.score.map(b => b.score).reduce((a, b) => a + b);
	const minutes = launch.timings.Time / 60;
	const botsCount = launch.simulation.score.length;
	const avgScorePercent = 1 / botsCount;
	const avgProductivity = totalScore / minutes / botsCount;
	const scoreStatistic = launch.simulation.score.map(AnalizeBotScore(minutes, avgProductivity, totalScore, avgScorePercent));
	const strategies = ConvertRecord(GroupBy(scoreStatistic, x => x.strategy), AnalizeGroupBots);
	return { botsTotal: AnalizeGroupBots(scoreStatistic), strategies };
}

type NormalizedLaunch = ReturnType<typeof NormilizeLaunch>;

function AnalizeNormalizedLaunhes(launches: NormalizedLaunch[]) {
	const strategiesArr = launches.map(x => ConvertRecord(x.strategies, s => s.avg));
	const strategies = strategiesArr.reduce(
		(acc, elem) => Object.entries(elem).reduce(
			(ac, [key, vlalue]) => { ac[key].push(vlalue); return ac }, acc),
		ConvertRecord(strategiesArr[0], (v) => new Array<typeof v>()));
	const strategiesProductivities = ConvertRecord(strategies, s => s.map(elem => elem.productivity.value))
	const strategiesProductivitiesAvg = ConvertRecord(strategiesProductivities, s => s.reduce((a, b) => a + b) / s.length);
	const strategiesVariance = ConvertRecord(strategiesProductivities, (ps, strategy) => ps.map(p => p - strategiesProductivitiesAvg[strategy]).map(x => x * x).reduce((a, b) => a + b) / ps.length)
	return ConvertRecord(strategiesVariance, (value) => ({ variance: value, sqrtVariance: Math.sqrt(value) }));
}

function AnalizeNormalizedLaunhesStability(launches: NormalizedLaunch[]) {
	const strategiesArr = launches.map(x => ConvertRecord(x.strategies, s => s.avg));
	const strategies = strategiesArr.reduce(
		(acc, elem) => Object.entries(elem).reduce(
			(ac, [key, vlalue]) => { ac[key].push(vlalue); return ac }, acc),
		ConvertRecord(strategiesArr[0], (v) => new Array<typeof v>()));
	const strategiesProductivities = ConvertRecord(strategies, s => s.map(elem => elem.productivity.value))
	const strategiesProductivitiesAvg = ConvertRecord(strategiesProductivities, s => s.reduce((a, b) => a + b) / s.length);
	return ConvertRecord(strategiesProductivities, (s, k) => s.reduce((a, b, i) => {
		a.sum+=b;
		const deviation = a.sum / (i + 1) - strategiesProductivitiesAvg[k];
		a.result.push(deviation*deviation);
		return a;
	}, {sum:0, result: [] as number[]}).result);
	// const strategiesProductivitiesAvg = ConvertRecord(strategiesProductivities, s => s.reduce((a, b) => a + b) / s.length);
	// const strategiesVariance = ConvertRecord(strategiesProductivities, (ps, strategy) => ps.map(p => p - strategiesProductivitiesAvg[strategy]).map(x => x * x).reduce((a, b) => a + b) / ps.length)
	// return ConvertRecord(strategiesVariance, (value) => ({ variance: value, sqrtVariance: Math.sqrt(value) }));
}

function AnalizeBotScore(minutes: number, avgProductivity: number, totalScore: number, avgScorePercent: number): (value: Score, index: number, array: Score[]) => { strategy: string; productivity: { value: number; deviation: number; deviation2: number; }; scorePercent: { value: number; deviation: number; deviation2: number; }; } & Score {
	return bot => Object.assign({
		strategy: StrategyName(bot),
		productivity: CalcStatisticStaff(bot.score / minutes, avgProductivity),
		scorePercent: CalcStatisticStaff(bot.score / totalScore * 100, avgScorePercent * 100),
	}, bot);
}

type BotStatistic = ReturnType<ReturnType<typeof AnalizeBotScore>>

function AnalizeGroupBots(group: BotStatistic[]) {
	const sum = group.reduce(DeepSum)
	const avg = DeepAvgBySum(sum, group.length);
	return { sum, avg }
}

function DeepEqual(a1: any, a2: any): boolean {
	const type = typeof a1;
	if (type !== typeof a2)
		return false
	if (type !== "object" || a1 === null || a2 === null) {
		return a1 === a2;
	}
	const keys1 = Object.keys(a1);
	const keys2 = Object.keys(a2);
	if (keys1.length !== keys2.length)
		return false;
	return keys1.reduce<boolean>((answer, key) => answer && DeepEqual(a1[key], a2[key]), true);
}

function SettingsAreEqual(s1: MetricSettings, s2: MetricSettings): boolean {
	return s1.label === s2.label && s1.mapID === s2.mapID && s1.simulationID === s2.simulationID && DeepEqual(s1.settings, s2.settings);
}

function GroupBySettings(metrics: Metrics[]): LaunchesGroup[] {
	const res: LaunchesGroup[] = [];
	function findGroup(metric: Metrics): LaunchesGroup {
		const group = res.find(g => SettingsAreEqual(g.settings, metric.settings));
		if (group) return group;
		const newGroup: LaunchesGroup = { settings: metric.settings, launches: [] }
		res.push(newGroup);
		return newGroup;
	}
	metrics.forEach(metric => {
		const group = findGroup(metric);
		group.launches.push({ simulation: metric.simulation, timings: metric.timings })
	})
	return res;
}

const args = process.argv.slice(2);
const inputFolder = args[0] || "experiments/raw";
const ouputFolder = args[1] || "experiments/out"

const files =
	fs.readdirSync(inputFolder, "utf-8").map(x => (console.log(x),`${inputFolder}/${x}`))
		.map(filename => fs.readFileSync(filename).toString("utf-8"))
		.map(file => JSON.parse(file) as Metrics[])

const metrics = (<Metrics[]>[]).concat(...files);
metrics.forEach(metrics => metrics.simulation.score.sort(scoreSorter));

if (!fs.existsSync(ouputFolder)) {
	fs.mkdirSync(ouputFolder);
}

const preparedMetrics = GroupBySettings(metrics).
	sort((a, b) => a.settings.label.localeCompare(b.settings.label)).
	map(({ settings, launches }) => ({ settings, launches: DeepAvgs(launches.map(NormilizeLaunch)), productivity: AnalizeNormalizedLaunhes(launches.map(NormilizeLaunch)), stability: AnalizeNormalizedLaunhesStability(launches.map(NormilizeLaunch)) }));
fs.writeFileSync(ouputFolder+"/"+"oddvar_v5.json", JSON.stringify(preparedMetrics));
fs.writeFileSync(ouputFolder+"/"+"oddvar_v5.csv", preparedMetrics.map(({ settings, launches, productivity }) => {
	const header = ["Стратегия", "Count",
		"Productivity",
		"Productivity deviation",
		"Productivity Deviation^2",
		"Score",
		"Score deviation",
		"Score Deviation^2",
		"",
		"Productivity variance",
		"Productivity sqrt_variance",
	]
	const ss = launches.strategies;
	const rows = Object.entries(ss).map(([s, value]) =>
		[
			s,
			settings.settings.bots[s],
			value.avg.productivity.value,
			value.avg.productivity.deviation,
			value.avg.productivity.deviation2,
			value.avg.scorePercent.value,
			value.avg.scorePercent.deviation,
			value.avg.scorePercent.deviation2,
			"",
			productivity[s].variance,
			productivity[s].sqrtVariance,
		],
	);
	return [[settings.label], header, ...rows].map(x => x.join(",")).join("\n");
}).join("\n\n\n"));
// fs.writeFileSync("oddvar_v5_sd.csv", preparedMetrics.map(({ settings, stability }) => {
// 	const row = [settings.label] as (string|number)[];
// 	const strategies = Object.keys(stability);
// 	for(let i = 0; i<stability[strategies[0]].length; i++) {
// 		row.push(Math.log10(strategies.reduce((sum, s)=>sum+stability[s][i], 0)))
// 	}
// 	return row;
// }).sort((a,b)=>a.length-b.length).map(x=>x.join(",")).join("\n"));
fs.writeFileSync(ouputFolder+"/"+"oddvar_productivity.csv", (function(){
	const y = preparedMetrics.map(({settings}) => Math.max(0, settings.settings.bots["Честный_Доверчивый"]-1)/(Object.values(settings.settings.bots).reduce((a,b)=>a+b)-1));
	const x1 = preparedMetrics.map(({launches})=>(launches.strategies["Честный_Доверчивый"]?.avg.productivity.value||0))
	const x2 = preparedMetrics.map(({launches})=>launches.strategies["Лжец_Доверчивый"]?.avg.productivity.value||0)
	return [
		`%;${y.join(";")}`,
		`Честный;${x1.join(";")}`,
		`Лгущий;${x2.join(";")}`,
	].join("\n");
})());
// const csv = [
// metrics[0].simulation.score.map(bot => bot.name),
// metrics[0].simulation.score.map(bot => bot.sender),
// metrics[0].simulation.score.map(bot => bot.evaluator),
// ].map(arr => arr.join(","));
// csv.push(...metrics.map(m => m.simulation.score.map(bot => bot.score).join(",")));
// fs.writeFileSync("oddvar.csv", csv.join("\n"));
// fs.writeFileSync("oddvar2.csv", Object.values(botsTable).map(bot => [bot.name, bot.sender, bot.evaluator, ...bot.score].join(",")).join("\n"));
// fs.writeFileSync("oddvar3.csv", Object.values(botsTable).map(bot => [bot.sender, bot.evaluator, ...bot.score].join(",")).join("\n"));

