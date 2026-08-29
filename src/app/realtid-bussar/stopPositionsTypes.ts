import type { IStopBoardChild } from "@shared/models/IStopBoardStation";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { hasDisplayablePlatformCode } from "../utilities/stopBoardStopResolution";

export type IStopPositionJson = {
	id: string;
	lat: number;
	lon: number;
	/** Hållplatsnamn; visas som label vid label-zoom. */
	name: string;
	/** GTFS location_type === 1 (stationsentitet). */
	isParent: boolean;
	/** GTFS location_type; 0 = plattform, 1 = station, 2 = entré/utgång. */
	locationType: number;
	/** Visningsbar plattformskod; interna OLD-värden utelämnas. */
	platformCode?: string;
	/** parent_station-id för plattform eller entré; saknas för parent/orphan. */
	parent?: string;
	/** Förenklad kartpresentation för ett aktivt stationsområde. */
	presentation?: "group-stop" | "platform-label";
};

const GTFS_ROUTE_TYPE_BUS = 700;
const GTFS_ROUTE_TYPE_SUBWAY = 401;

function averageLatLon(points: { stop_lat: number; stop_lon: number }[]): {
	lat: number;
	lon: number;
} {
	return {
		lat: points.reduce((sum, point) => sum + point.stop_lat, 0) / points.length,
		lon: points.reduce((sum, point) => sum + point.stop_lon, 0) / points.length,
	};
}

export function belongsToFocusedStation(
	stop: Pick<IStopPositionJson, "id" | "parent" | "isParent">,
	focusedParentIds: ReadonlySet<string>,
): boolean {
	if (focusedParentIds.size === 0) return false;
	if (stop.parent && focusedParentIds.has(stop.parent)) return true;
	return Boolean(stop.isParent && focusedParentIds.has(stop.id));
}

/** En klickbar bussikon, en klickbar tunnelbaneuppgång och diskreta lägesetiketter. */
export function buildFocusedStationMarkers(
	children: IStopBoardChild[],
	departures: { stop_id: string; route_type?: number | null }[],
	stationName: string,
): IStopPositionJson[] {
	if (children.length === 0) return [];
	if (
		!children.some((child) => hasDisplayablePlatformCode(child.platform_code))
	) {
		return [];
	}

	const routeTypesByStopId = new Map<string, Set<number>>();
	for (const departure of departures) {
		if (departure.route_type == null) continue;
		const routeTypes =
			routeTypesByStopId.get(departure.stop_id) ?? new Set<number>();
		routeTypes.add(departure.route_type);
		routeTypesByStopId.set(departure.stop_id, routeTypes);
	}

	const platforms = children.filter((child) => child.location_type === 0);
	const busPlatforms = platforms.filter((child) =>
		routeTypesByStopId.get(child.stop_id)?.has(GTFS_ROUTE_TYPE_BUS),
	);
	const subwayPlatforms = platforms.filter((child) =>
		routeTypesByStopId.get(child.stop_id)?.has(GTFS_ROUTE_TYPE_SUBWAY),
	);
	const resolvedName =
		stationName.trim() || children[0]?.stop_name || "Hållplats";
	const markers: IStopPositionJson[] = [];

	if (busPlatforms.length > 0) {
		const busParentId = busPlatforms[0].parent_station;
		const center = averageLatLon(busPlatforms);
		markers.push({
			id: busParentId,
			lat: center.lat,
			lon: center.lon,
			name: resolvedName,
			isParent: true,
			locationType: 1,
			presentation: "group-stop",
		});
		for (const platform of busPlatforms) {
			if (!hasDisplayablePlatformCode(platform.platform_code)) continue;
			markers.push({
				id: platform.stop_id,
				lat: platform.stop_lat,
				lon: platform.stop_lon,
				name: resolvedName,
				isParent: false,
				locationType: 0,
				platformCode: platform.platform_code?.trim(),
				parent: platform.parent_station,
				presentation: "platform-label",
			});
		}
	}

	if (subwayPlatforms.length > 0) {
		const subwayParentIds = new Set(
			subwayPlatforms.map((platform) => platform.parent_station),
		);
		const entrance = children.find(
			(child) =>
				child.location_type === 2 && subwayParentIds.has(child.parent_station),
		);
		const subwayParentId = subwayPlatforms[0].parent_station;
		const subwayCenter = averageLatLon(subwayPlatforms);
		markers.push(
			entrance
				? {
						id: entrance.stop_id,
						lat: entrance.stop_lat,
						lon: entrance.stop_lon,
						name: resolvedName,
						isParent: false,
						locationType: 2,
						parent: entrance.parent_station,
						presentation: "group-stop",
					}
				: {
						id: subwayParentId,
						lat: subwayCenter.lat,
						lon: subwayCenter.lon,
						name: resolvedName,
						isParent: true,
						locationType: 2,
						presentation: "group-stop",
					},
		);
	}

	return markers;
}

const STATION_GROUP_MAX_DISTANCE_METERS = 750;

function clusterStopsByNameAndDistance(
	stops: IStopPositionJson[],
): IStopPositionJson[][] {
	const byName = new Map<string, IStopPositionJson[]>();
	for (const stop of stops) {
		const key = stop.name.trim().toLowerCase();
		const current = byName.get(key) ?? [];
		current.push(stop);
		byName.set(key, current);
	}

	const clusters: IStopPositionJson[][] = [];
	for (const group of byName.values()) {
		const remaining = [...group];
		while (remaining.length > 0) {
			const cluster = [remaining.shift() as IStopPositionJson];
			let grew = true;
			while (grew) {
				grew = false;
				for (let index = remaining.length - 1; index >= 0; index -= 1) {
					const candidate = remaining[index];
					const nearby = cluster.some(
						(member) =>
							getDistanceFromLatLon(
								member.lat,
								member.lon,
								candidate.lat,
								candidate.lon,
							) <= STATION_GROUP_MAX_DISTANCE_METERS,
					);
					if (!nearby) continue;
					cluster.push(candidate);
					remaining.splice(index, 1);
					grew = true;
				}
			}
			clusters.push(cluster);
		}
	}
	return clusters;
}

function presentStationCluster(
	cluster: IStopPositionJson[],
): IStopPositionJson[] {
	const alreadyPresented = cluster.filter((stop) => Boolean(stop.presentation));
	const raw = cluster.filter((stop) => !stop.presentation);
	if (alreadyPresented.length > 0 && raw.length === 0) {
		return alreadyPresented;
	}

	const source = raw.length > 0 ? raw : cluster;
	const subwayParentIds = new Set(
		source
			.filter((stop) => stop.locationType === 2 && stop.parent)
			.map((stop) => stop.parent as string),
	);
	const entrances = source.filter((stop) => stop.locationType === 2);
	const busPlatforms = source.filter(
		(stop) =>
			stop.locationType === 0 &&
			(!stop.parent || !subwayParentIds.has(stop.parent)),
	);
	const busParents = source.filter(
		(stop) => stop.isParent && !subwayParentIds.has(stop.id),
	);
	const hasPlatformCodes = source.some((stop) =>
		hasDisplayablePlatformCode(stop.platformCode),
	);
	if (!hasPlatformCodes) return source;

	const stationName =
		source.find((stop) => stop.name.trim())?.name.trim() || "Hållplats";
	const markers: IStopPositionJson[] = [];

	if (busPlatforms.length > 0 || busParents.length > 0) {
		const busAnchor = busParents[0] ?? busPlatforms[0];
		const points = busPlatforms.length > 0 ? busPlatforms : busParents;
		markers.push({
			id: busAnchor.isParent ? busAnchor.id : busAnchor.parent || busAnchor.id,
			lat: points.reduce((sum, stop) => sum + stop.lat, 0) / points.length,
			lon: points.reduce((sum, stop) => sum + stop.lon, 0) / points.length,
			name: stationName,
			isParent: true,
			locationType: 1,
			presentation: "group-stop",
		});
		for (const platform of busPlatforms) {
			if (!hasDisplayablePlatformCode(platform.platformCode)) continue;
			markers.push({
				...platform,
				name: stationName,
				presentation: "platform-label",
			});
		}
	}

	if (entrances.length > 0) {
		const entrance = entrances[0];
		markers.push({
			...entrance,
			name: stationName,
			presentation: "group-stop",
		});
	}

	return markers;
}

/** En bussikon, en tunnelbaneuppgång och diskreta lägesetiketter per stationsgrupp. */
export function collapseStopsIntoStationPresentation(
	stops: IStopPositionJson[],
): IStopPositionJson[] {
	return clusterStopsByNameAndDistance(stops).flatMap(presentStationCluster);
}

export type StopsPositionsFile = { v: string; stops: IStopPositionJson[] };

export const STOP_MARKERS_MIN_ZOOM = 10;
/** Små prickar (utan ikon) från denna zoom. */
export const STOP_MARKERS_COMPACT_ZOOM = 13;
/** Full markör med buss-ikon från denna zoom. */
export const STOP_MARKERS_DETAIL_ZOOM = 15;
/** Hållplatsnamn bredvid ikonen från denna zoom. */
export const STOP_MARKERS_LABEL_ZOOM = 18;
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
	const {
		north: nCap,
		south: sCap,
		east: eCap,
		west: wCap,
	} = clipToRestriction;
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
	focusedStationIds: string[] = [],
): IStopPositionJson[] {
	if (!all?.length) {
		return [];
	}
	const focusedParentIds = new Set(focusedStationIds);
	const presentedFocused = all.filter((stop) => Boolean(stop.presentation));
	const focusedMarkers =
		presentedFocused.length > 0
			? presentedFocused
			: all.filter((stop) => belongsToFocusedStation(stop, focusedParentIds));
	if (zoom < STOP_MARKERS_MIN_ZOOM || !bounds) {
		return focusedMarkers;
	}
	const { north, south, east, west } = bounds;
	const inBounds = all.filter(
		(s) => s.lat >= south && s.lat <= north && s.lon >= west && s.lon <= east,
	);
	if (zoom < STOP_MARKERS_LABEL_ZOOM) {
		const parentsOnly = inBounds.filter(
			(s) =>
				s.presentation === "group-stop" ||
				(!s.presentation && (s.isParent || !s.parent)),
		);
		return parentsOnly.slice(0, stopMarkersCapForZoom(zoom));
	}

	const collapsed = collapseStopsIntoStationPresentation(inBounds);
	const parentsWithEntrances = new Set(
		inBounds
			.filter((stop) => stop.locationType === 2 && stop.parent)
			.map((stop) => stop.parent as string),
	);
	const visible = collapsed.filter((stop) => {
		if (stop.presentation) return true;
		if (stop.isParent) return false;
		if (stop.locationType === 2) return true;
		return !stop.parent || !parentsWithEntrances.has(stop.parent);
	});
	const cap = stopMarkersCapForZoom(zoom);
	if (focusedParentIds.size === 0) return visible.slice(0, cap);

	const focusedPresented = focusedMarkers.filter((stop) =>
		Boolean(stop.presentation),
	);
	if (focusedPresented.length === 0) return visible.slice(0, cap);

	const focusedIds = new Set(focusedPresented.map((stop) => stop.id));
	const surrounding = visible.filter((stop) => {
		if (focusedIds.has(stop.id)) return false;
		return !belongsToFocusedStation(stop, focusedParentIds);
	});
	return [...focusedPresented, ...surrounding].slice(
		0,
		Math.max(cap, focusedPresented.length),
	);
}
