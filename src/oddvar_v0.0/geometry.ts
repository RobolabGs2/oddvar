
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

	public Norm(): Point {
		return this.Div(this.Len());
	}

	public Dist(p: Point): number {
		return p.Sub(this).Len();
	}

	public Mult(k: number): Point {
		return new Point(this.x * k, this.y * k);
	}

	public Div(k: number): Point {
		return new Point(this.x / k, this.y / k);
	}

	public Transform(m: Matrix): Point {
		let x = m.Get(0, 0) * this.x + m.Get(1, 0) * this.y + m.Get(2, 0);
		let y = m.Get(0, 1) * this.x + m.Get(1, 1) * this.y + m.Get(2, 1);
		let z = m.Get(0, 2) * this.x + m.Get(1, 2) * this.y + m.Get(2, 2);
		return new Point(x / z, y / z);
	}

	public Invert(): Point {
		return new Point(-this.x, -this.y);
	}
}

export class Size
{
	public constructor(public width: number, public height: number) {
	}

	public Area(): number {
		return this.width * this.height;
	}
}

export class Matrix
{
	private data = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

	public static Zero(): Matrix {
		return new Matrix();
	}

	public static Ident(): Matrix {
		let result = new Matrix();
		result.data[0][0] = 1;
		result.data[1][1] = 1;
		result.data[2][2] = 1;
		return result;
	}

	public static Rotation(angle: number): Matrix {
		let sin = Math.sin(angle);
		let cos = Math.cos(angle);
		return this.RotationCosSin(cos, sin);
	}
	
	public static RotationCosSin(cos: number, sin: number): Matrix {
		let result = Matrix.Ident();
		result.data[0][0] = cos;
		result.data[0][1] = sin;
		result.data[1][0] = -sin;
		result.data[1][1] = cos;
		return result;
	}

	public static Translate(p: Point): Matrix;
	public static Translate(x: number, y: number): Matrix;
	public static Translate(x: Point|number, y?: number): Matrix {
		let result = Matrix.Ident();
		if (y) {
			result.data[2][0] = x as number;
			result.data[2][1] = y;
		}
		else {
			let p = x as Point;
			result.data[2][0] = p.x;
			result.data[2][1] = p.y;
		}
		return result;
	}

	public Get(i: number, j: number): number {
		return this.data[i][j];
	}

	public Set(i: number, j: number, v: number) {
		this.data[i][j] = v;
	}

	public Mult(m: Matrix): Matrix {
		let result = Matrix.Zero();
		for (let i = 0; i < 3; ++i)
			for (let j = 0; j < 3; ++j)
				for (let k = 0; k < 3; ++k)
					result.data[i][j] += this.data[i][k] * m.data[k][j];
		return result;
	}
}
