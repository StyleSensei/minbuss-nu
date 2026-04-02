/** GTFS (and extended Nordic) route_type → Swedish UI strings. */
const GTFS_ROUTE_TYPE_LABELS_SV: Record<
	number,
	{ short: string; definite: string }
> = {
	100: { short: "Pendeltåg", definite: "Pendeltåget" },
	401: { short: "Tunnelbana", definite: "Tåget" },
	700: { short: "Buss", definite: "Bussen" },
	900: { short: "Tåg", definite: "Tåget" },
	1000: { short: "Båt", definite: "Båten" },
};

const DEFAULT_ROUTE_LABEL_SV = {
	short: "Trafik",
	definite: "Fordonet",
} as const;

function getRouteTypeLabelsSv(routeType: number | null | undefined) {
	if (routeType == null) {
		return DEFAULT_ROUTE_LABEL_SV;
	}
	return GTFS_ROUTE_TYPE_LABELS_SV[routeType] ?? DEFAULT_ROUTE_LABEL_SV;
}

/** Short mode label for headings and badges (e.g. "Buss", "Tunnelbana"). */
export function gtfsRouteModeShortLabelSv(
	routeType: number | null | undefined,
): string {
	return getRouteTypeLabelsSv(routeType).short;
}

/** Swedish definite noun for in-traffic copy (e.g. "Bussen är i trafik"). */
export function gtfsRouteVehicleLabelSv(
	routeType: number | null | undefined,
): string {
	return getRouteTypeLabelsSv(routeType).definite;
}
