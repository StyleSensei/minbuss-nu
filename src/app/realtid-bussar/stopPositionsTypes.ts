import { isStopIdExcludedFromClient } from "@/app/utilities/stopIdRules";

export type IStopPositionJson = { id: string; lat: number; lon: number };

export type StopsPositionsFile = { v: string; stops: IStopPositionJson[] };

export const STOP_MARKERS_MIN_ZOOM = 10;
/** Små prickar (utan ikon) från denna zoom. */
export const STOP_MARKERS_COMPACT_ZOOM = 13;
/** Full markör med buss-ikon från denna zoom. */
export const STOP_MARKERS_DETAIL_ZOOM = 16;
/** Övre tak vid hög zoom; vid låg zoom används lägre tak (färre AdvancedMarker = mindre lagg). */
export const STOP_MARKERS_MAX_VISIBLE = 320;

/**
 * Tak på antal hållplatsmarkörer beroende på zoom — vid mycket utzoomad karta är ytan enorm; få markörer räcker visuellt och spar prestanda.
 */
export function stopMarkersCapForZoom(zoom: number): number {
	if (zoom < 10.35) return 20;
	if (zoom < 10.65) return 30;
	if (zoom < 11) return 45;
	if (zoom < 11.5) return 60;
	if (zoom < 12) return 95;
	if (zoom < 13) return 140;
	if (zoom < STOP_MARKERS_DETAIL_ZOOM) return 230;
	return STOP_MARKERS_MAX_VISIBLE;
}

/** Expand bounds by `ratio` of the lat/lng span; clips to the map restriction box (default: Stockholm Mälardalen). */
export function expandStopQueryBounds(
	bounds: google.maps.LatLngBoundsLiteral,
	ratio: number,
	clipToRestriction: google.maps.LatLngBoundsLiteral = {
		north: 60,
		south: 58.5,
		east: 20,
		west: 16.5,
	},
): google.maps.LatLngBoundsLiteral {
	const latSpan = bounds.north - bounds.south;
	const lngSpan = bounds.east - bounds.west;
	const dLat = (latSpan * ratio) / 2;
	const dLng = (lngSpan * ratio) / 2;
	const { north: nCap, south: sCap, east: eCap, west: wCap } = clipToRestriction;
	return {
		north: Math.min(nCap, bounds.north + dLat),
		south: Math.max(sCap, bounds.south - dLat),
		east: Math.min(eCap, bounds.east + dLng),
		west: Math.max(wCap, bounds.west - dLng),
	};
}

/** Snap to a degree grid so nearby viewports share CDN cache keys. */
export function snapStopQueryBounds(
	bounds: google.maps.LatLngBoundsLiteral,
	stepDeg = 0.02,
): google.maps.LatLngBoundsLiteral {
	return {
		north: Math.ceil(bounds.north / stepDeg) * stepDeg,
		south: Math.floor(bounds.south / stepDeg) * stepDeg,
		east: Math.ceil(bounds.east / stepDeg) * stepDeg,
		west: Math.floor(bounds.west / stepDeg) * stepDeg,
	};
}

export function filterStopsByLatLngBounds(
	stops: IStopPositionJson[],
	bounds: google.maps.LatLngBoundsLiteral,
): IStopPositionJson[] {
	const { north, south, east, west } = bounds;
	return stops.filter(
		(s) => s.lat >= south && s.lat <= north && s.lon >= west && s.lon <= east,
	);
}

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
	const cap = stopMarkersCapForZoom(zoom);
	return inView.slice(0, cap);
}
