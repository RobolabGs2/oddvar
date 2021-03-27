import { ReflectionJSON } from "src/oddvar/reflection";
import { ImageSource } from "../oddvar/textures";

export function getJSON<T = any>(url: string): Promise<T> {
	return fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	}).then(r => r.json()) as Promise<T>
}

export class ResourceManager implements ImageSource {
	private constructor(private images: Record<string, CanvasImageSource | undefined>) {

	}

	GetImage(name: string): CanvasImageSource {
		const img = this.images[name];
		if (!img)
			throw Error(`Not found image with name ${name}`);
		return img
	}

	public static DownloadImages(urls: Record<string, string>): Promise<ResourceManager> {
		return Promise.all(
			Object.entries(urls).
				map(([name, url]) => loadImage(url).then(img => [name, img]))
		).then(pairs => new ResourceManager(Object.fromEntries(pairs)))
	}
}

export function loadImage(url: string): Promise<CanvasImageSource> {
	return new Promise(function (resolve, reject) {
		let img = new Image();
		img.onload = function () {
			return resolve(img);
		};
		img.onerror = function () {
			return reject(name);
		};
		img.src = url;
	});
}

export const DownloadResources = () => Promise.all([
	getJSON<ReflectionJSON>("resources/reflection.json"),
	getJSON<Record<string, string>>("resources/images.json").then(ResourceManager.DownloadImages)
])
