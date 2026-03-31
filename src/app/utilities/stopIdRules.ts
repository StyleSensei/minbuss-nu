/** Stops whose GTFS id ends with this suffix are omitted from map/search lists. */
export function isStopIdExcludedFromClient(stopId: string): boolean {
	return stopId.endsWith("0");
}
