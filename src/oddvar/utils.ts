export function getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
	if (nullable) {
		return nullable;
	}
	return default_;
}

export type MapOfArrays<T> = {
	[K in keyof T]: T[K][]
}

export type EventHandler<T, This = unknown> = {
	[K in keyof T]: (this: This, data: T[K]) => void
}

type ListenersMap<EventsMap, This = unknown> = MapOfArrays<EventHandler<EventsMap, This>>;

export class Observable<EventsMap> {
	protected listeners: ListenersMap<EventsMap, this> = new Proxy<ListenersMap<EventsMap, this>>({} as ListenersMap<EventsMap, this>, {
		get: (map, propertyName, receiver) => {
			let property = Reflect.get(map, propertyName, receiver);
			if(property !== undefined)
				return property;
			property = [];
			Reflect.set(map, propertyName, property, receiver);
			return property;
		}
	});
	public addEventListener<E extends keyof EventsMap>(eventType: E, listener: EventHandler<EventsMap, this>[E]) {
		this.listeners[eventType].push(listener);
	}
	protected dispatchEvent<E extends keyof EventsMap>(eventType: E, event: EventsMap[E]) {
		this.listeners[eventType].forEach(listener => listener.call(this, event));
	}
}
