
export class Point
{
	public constructor(public x: number, public y: number) {
	}

	public Add(p: Point): Point {
		return new Point(this.x + p.x, this.y + p.y);
	}

	public Sub(p: Point): Point {
		return new Point(this.x - p.x, this.y - p.y);
	}

	public Dot(p: Point): number {
		return this.x * p.x + this.y * p.y;
	}

	public Len(): number {
		return Math.sqrt(this.Dot(this));
	}

	public Dist(p: Point): number {
		return p.Sub(this).Len();
	}

	public Mult(k: number): Point {
		return new Point(this.x * k, this.y * k);
	}

	public Invert(): Point {
		return new Point(-this.x, -this.y);
	}
}

export class Size
{
	public constructor(public width: number, public height: number) {
	}
}
