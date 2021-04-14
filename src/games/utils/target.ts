import { Point } from '../../oddvar/geometry';
import { Body } from '../../oddvar/physics/body';
import { Observable } from '../../oddvar/utils';

export interface TargetEvents<Player> {
	relocate: { from: Point, to: Point };
	collision: Player;
}

export class Target<Player> extends Observable<TargetEvents<Player>, Target<Player>> {
	readonly players = new Map<Body, Player>();

	constructor(readonly body: Body) {
		super();
		body.AddCollisionListener((self, another) => {
			const player = this.players.get(another);
			if (player !== undefined)
				this.dispatchEvent("collision", player);
		});
	}

	relocate(to: Point) {
		this.dispatchEvent("relocate", { from: this.body.entity.location, to });
		this.body.entity.location = to;
	}
}
