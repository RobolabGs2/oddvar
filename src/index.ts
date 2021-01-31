import { Oddvar } from "./oddvar";

{
	let example = `
[
	{
		"type": "world.Entity",
		"constructor": [{"Point": [50, 20]}, 0],
		"child": [
			{
				"type": "physics.RectangleBody",
				"constructor": [{"Size": [10, 10]}]
			},
			{
				"type": "graphics.Rectangle",
				"constructor": [{"Size": [10, 10]}]
			},
			{
				"type": "controller.WalkController"
			},
			{
				"type": "world.TailEntity",
				"constructor": [{"Point": [20, 0]}],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{"Size": [5, 5]}]
					},
					{
						"type": "graphics.Rectangle",
						"constructor": [{"Size": [5, 5]}]
					},
					{
						"type": "controller.WalkController"
					}
				]
			}
		]
	}
]
`
	new Oddvar(example);
}
