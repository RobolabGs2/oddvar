export function ObjectFromEntries<T1 extends string | number, T2>(entries: [T1, T2][]): Record<T1, T2> {
	return entries.reduce((acc, entry) => { acc[entry[0]] = entry[1]; return acc }, {} as Record<T1, T2>);
}

export type StrategyName = "Честный_Доверчивый" | "Честный_Скептик" | "Честный_Параноик" | "Лжец_Доверчивый" | "Лжец_Скептик" | "Лжец_Параноик" | "Око_за_око" | "Злопамятный" | "Прощающий"
export const STRATEGIES: StrategyName[] = ["Честный_Доверчивый", "Честный_Скептик", "Честный_Параноик", "Лжец_Доверчивый", "Лжец_Скептик", "Лжец_Параноик", "Око_за_око", "Злопамятный", "Прощающий"]
export const BASE_STRATEGIES: StrategyName[] = ["Честный_Доверчивый", "Честный_Скептик", "Честный_Параноик", "Лжец_Доверчивый", "Лжец_Скептик", "Лжец_Параноик"]
export const RATING_STRATEGIES: StrategyName[] = ["Око_за_око", "Злопамятный", "Прощающий"]
