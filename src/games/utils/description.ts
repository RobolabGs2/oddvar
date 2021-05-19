import { GameLogic } from "../../oddvar/manager";
import { Oddvar } from "../../oddvar/oddvar";
import { HTML } from "../../web/html";
import { WindowsManager } from "../../web/windows";
import { GameMap } from "./game_map";
import { WallCreator } from "./wall_manager";

export type MapCreator = (oddvar: Oddvar, createWall: WallCreator) => void;
export type MapType = MapCreator | GameMap;


export function IsGameMap(m: MapType): m is GameMap {
	return m instanceof GameMap;
}

export interface SimulatorDescription<SettingsT extends object, MapT extends MapType> {
	/** Создаёт новый экземпляр симуляции */
	NewSimulation(oddvar: Oddvar, map: MapT, ui: WindowsManager, settings: SettingsT): GameLogic
	/** Проверяет, поддерживается ли данный вид карты */
	IsSupportedMap(map: MapType): map is MapT;
	/** Описывает типы полей настроек, потому что некогда разбираться с рефлексией */
	SettingsInputType(): Record<keyof SettingsT, HTML.Input.Type>
	/** Имя на русском языке для отображения в UI */
	readonly name: string;
}