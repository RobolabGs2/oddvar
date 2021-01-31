import { Oddvar } from "./oddvar";

{
	let example: any =
	[
		{
			"type": "world.Entity",
			"constructor": [{"Point": [100, 200]}, 0.1],
			"child": [
				{
					"type": "physics.RectangleBody",
					"constructor": [{"density": 1}, {"Size": [20, 20]}],
					"child": [
						{
							"type": "controller.KickController",
							"constructor": [{"Point": [100, 0]}]
						}
					]
				},
				{
					"type": "graphics.Rectangle",
					"constructor": [{"Size": [20, 20]}]
				},
				{
					"type": "world.TailEntity",
					"constructor": [{"Point": [20, 0]}],
					"child": [
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
		},	//	1
		{
			"type": "world.Entity",
			"constructor": [{"Point": [300, 300]}, -0.785398],
			"child": [
				{
					"type": "physics.RectangleBody",
					"constructor": [{"density": 1}, {"Size": [250, 30]}],
					"child": [
						{
							"type": "controller.KickController",
							"constructor": [{"Point": [0, 0]}, true]
						}
					]
				},
				{
					"type": "graphics.Rectangle",
					"constructor": [{"Size": [250, 30]}]
				}
			]
		},	//	2
		{
			"type": "world.Entity",
			"constructor": [{"Point": [100, 300]}, 0.785398],
			"child": [
				{
					"type": "physics.RectangleBody",
					"constructor": [{"density": 1}, {"Size": [250, 30]}],
					"child": [
						{
							"type": "controller.KickController",
							"constructor": [{"Point": [0, 0]}, true]
						}
					]
				},
				{
					"type": "graphics.Rectangle",
					"constructor": [{"Size": [250, 30]}]
				}
			]
		},	//	3
		{
			"type": "world.Entity",
			"constructor": [{"Point": [300, 100]}, 0.785398],
			"child": [
				{
					"type": "physics.RectangleBody",
					"constructor": [{"density": 1}, {"Size": [250, 30]}],
					"child": [
						{
							"type": "controller.KickController",
							"constructor": [{"Point": [0, 0]}, true]
						}
					]
				},
				{
					"type": "graphics.Rectangle",
					"constructor": [{"Size": [250, 30]}]
				}
			]
		},	//	4
		{
			"type": "world.Entity",
			"constructor": [{"Point": [100, 100]}, -0.785398],
			"child": [
				{
					"type": "physics.RectangleBody",
					"constructor": [{"density": 1}, {"Size": [250, 30]}],
					"child": [
						{
							"type": "controller.KickController",
							"constructor": [{"Point": [0, 0]}, true]
						}
					]
				},
				{
					"type": "graphics.Rectangle",
					"constructor": [{"Size": [250, 30]}]
				}
			]
		}
	]

	
	new Oddvar(JSON.stringify(example));
}
