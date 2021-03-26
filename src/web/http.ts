export function getJSON(url: string): Promise<any> {
	return fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		}
	}).then(r => r.json())
}