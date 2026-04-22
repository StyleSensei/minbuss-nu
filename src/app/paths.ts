import {
	getRegionPathSlugForOperator,
	OPERATOR_TO_REGION_PATH,
	REGION_PATH_TO_OPERATOR,
} from "@shared/config/realtimeRegionPaths";

export enum Paths {
	Home = "/",
	Search = "/realtid-bussar/stockholm",
	About = "/om",
}

export const REALTID_BUS_PATH_PREFIX = "/realtid-bussar/";

export function parseRegionSlugFromRealtimePathname(
	pathname: string | null | undefined,
): string | null {
	if (!pathname) return null;
	const normalized =
		pathname.endsWith("/") && pathname.length > 1
			? pathname.slice(0, -1)
			: pathname;
	if (!normalized.startsWith(REALTID_BUS_PATH_PREFIX)) return null;
	const rest = normalized.slice(REALTID_BUS_PATH_PREFIX.length);
	const segment = rest.split("/").filter(Boolean)[0];
	if (!segment) return null;
	try {
		return decodeURIComponent(segment).toLowerCase();
	} catch {
		return segment.toLowerCase();
	}
}

/**
 * Operatörsslug för API/karta utifrån nuvarande kart-URL (region- eller äldre operatörssegment).
 */
export function parseOperatorFromRealtimePathname(
	pathname: string | null | undefined,
): string | null {
	const seg = parseRegionSlugFromRealtimePathname(pathname);
	if (!seg) return null;
	const fromRegion = REGION_PATH_TO_OPERATOR[seg];
	if (fromRegion) return fromRegion;
	if (seg in OPERATOR_TO_REGION_PATH) return seg;
	return null;
}

export function searchPathForOperator(operator: string): string {
	const op = operator.trim().toLowerCase();
	const region = getRegionPathSlugForOperator(op);
	return `${REALTID_BUS_PATH_PREFIX}${encodeURIComponent(region)}`;
}

export function isRealtimeMapPath(pathname: string | null | undefined): boolean {
	if (!pathname) return false;
	const normalized =
		pathname.endsWith("/") && pathname.length > 1
			? pathname.slice(0, -1)
			: pathname;
	return normalized.startsWith(REALTID_BUS_PATH_PREFIX);
}

export function lineSearchUrl(
	routeCandidate: string,
	operator: string,
	options?: { mapFit?: boolean },
): string {
	const params = new URLSearchParams();
	params.set("linje", routeCandidate);
	if (options?.mapFit) {
		params.set("mapfit", "1");
	}
	const base = searchPathForOperator(operator);
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}
