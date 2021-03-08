import { World } from "./world";
import { DeadlyWorld, Factory, Serializable} from "./base";


export class Oddvar
{
	public underWorld = new Map<string, Serializable>();

	constructor(
		public world: World
	) { }

	public tick(dt: number) {
		if (dt > 0.03)
			dt = 0.03;
		// factories.tick(dt);
	}

	public GetDelta(force: boolean = false): Record<string, any> {
		const result: Record<string, any> = {};
		this.underWorld.forEach((s, id) => {
			const delta = s.ToDelta(force);
			if (delta)
				result[id] = delta;
		})
		return result;
	}

	public ApplyDelta(snapshot: Record<string, any>): void {
		for(let name in snapshot) {
			this.underWorld.get(name)?.FromDelta(snapshot[name]);
		}
	}

	// TODO: костыль
	public AddInUnderWorld(s: Serializable) {
		this.underWorld.set(s.Name, s);
	}
}
