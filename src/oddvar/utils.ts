export function getOrDefault<T>(nullable: T | null | undefined, default_: T): T {
	if (nullable) {
		return nullable;
	}
	return default_;
}