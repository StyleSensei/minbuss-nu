import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";

export type IStopPositionJson = { id: string; lat: number; lon: number };

export type StopsPositionsFile = { v: string; stops: IStopPositionJson[] };

export const STOP_MARKERS_MIN_ZOOM = 10;
/** Små prickar (utan ikon) från denna zoom. */
export const STOP_MARKERS_COMPACT_ZOOM = 13;
/** Full markör med buss-ikon från denna zoom. */
export const STOP_MARKERS_DETAIL_ZOOM = 16;
export const STOP_MARKERS_MAX_VISIBLE = 500;

export function filterStopsInViewport(
	all: IStopPositionJson[] | null,
	zoom: number,
	bounds: google.maps.LatLngBoundsLiteral | null,
): IStopPositionJson[] {
	if (!all?.length || zoom < STOP_MARKERS_MIN_ZOOM || !bounds) {
		return [];
	}
	const { north, south, east, west } = bounds;
	const inView = all.filter(
		(s) =>
			!isStopIdExcludedFromClient(s.id) &&
			s.lat >= south &&
			s.lat <= north &&
			s.lon >= west &&
			s.lon <= east,
	);
	return inView.slice(0, STOP_MARKERS_MAX_VISIBLE);
}
