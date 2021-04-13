import { Point } from "../../oddvar/geometry";


export interface Administrator
{
	Work(): Point;
}

export class RandomAdministrator implements Administrator
{
	Work(): Point {
		return new Point(Math.random(), Math.random()).Sub(new Point(0.5, 0.5));
	}
}

