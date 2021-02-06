import { Oddvar } from "oddvar";

{
	let example: any =
		[
			{
				"type": "world.Entity",
				"constructor": [{ "Point": [100, 200] }, 0.1],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{ "density": 1 }, { "Size": [20, 20] }],
						"child": [
							// {
							// 	"type": "controller.KickController",
							// 	"constructor": [{ "Point": [100, 0] }]
							// },
							{
								"type": "controller.PathWalkController",
								"constructor": [[{ "Point": [250, 250] },{ "Point": [200, 200] },{ "Point": [150, 150] }]],
								"child": [
									{
										"type": "graphics.PointAvatar",
										"constructor": [],
									}
								]
							},
							{
								"type": "graphics.RectangleBodyAvatar",
								"constructor": [{ "RectangleTexture": [{ "fill": "red", "stroke": "green" }] }]
							},
							{
								"type": "graphics.DebugBodyAvatar",
								"constructor": [{ "RectangleTexture": [{ "fill": "red", "stroke": "green" }] }]
							}
						]
					},
					{
						"type": "world.TailEntity",
						"constructor": [{ "Point": [11, 0] }, 0.0],
						"child": [
							{
								"type": "physics.RaySensor",
								"constructor": [],
								"child": [
									{
										"type": "graphics.DebugRaySensor",
										"constructor": []
									}
								]
							}
						]
					},
					{
						"type": "world.TailEntity",
						"constructor": [{ "Point": [20, 0] }],
						"child": [
							{
								"type": "graphics.EntityAvatar",
								"constructor": [{ "Size": [5, 5] }, { "RectangleTexture": [{ "stroke": "red" }] }]
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
				"constructor": [{ "Point": [300, 300] }, -0.785398],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{ "density": 1 }, { "Size": [250, 30] }],
						"child": [
							{
								"type": "controller.KickController",
								"constructor": [{ "Point": [0, 0] }, true]
							},
							{
								"type": "graphics.RectangleBodyAvatar",
								"constructor": [{ "RectangleTexture": [{ "fill": "rgba(128, 0, 128, 0.5)" }] }]
							}
						]
					}
				]
			},	//	2
			{
				"type": "world.Entity",
				"constructor": [{ "Point": [100, 300] }, 0.785398],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{ "density": 1 }, { "Size": [250, 30] }],
						"child": [
							{
								"type": "controller.KickController",
								"constructor": [{ "Point": [0, 0] }, true]
							},
							{
								"type": "graphics.RectangleBodyAvatar",
								"constructor": [{ "RectangleTexture": [{ "stroke": "#0a0" }] }]
							}
						]
					}
				]
			},	//	3
			{
				"type": "world.Entity",
				"constructor": [{ "Point": [300, 100] }, 0.785398],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{ "density": 1 }, { "Size": [250, 30] }],
						"child": [
							{
								"type": "controller.KickController",
								"constructor": [{ "Point": [0, 0] }, true]
							},
							{
								"type": "graphics.RectangleBodyAvatar",
								"constructor": [{ "RectangleTexture": [] }]
							}
						]
					}
				]
			},	//	4
			{
				"type": "world.Entity",
				"constructor": [{ "Point": [100, 100] }, -0.785398],
				"child": [
					{
						"type": "physics.RectangleBody",
						"constructor": [{ "density": 1 }, { "Size": [250, 30] }],
						"child": [
							{
								"type": "controller.KickController",
								"constructor": [{ "Point": [0, 0] }, true]
							},
							{
								"type": "graphics.RectangleBodyAvatar",
								"constructor": [{ "RectangleTexture": [] }]
							}
						]
					}
				]
			}
		]


	new Oddvar(JSON.stringify(example));
}
