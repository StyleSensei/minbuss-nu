import {
	canonicalizeOperatorSlug,
	getOperatorRegistryEntryById,
	getOperatorRegistryEntryBySlug,
	SWEDEN_FALLBACK_MAP_VIEW,
	type OperatorMapBounds,
	type OperatorMapView,
} from "./operatorsRegistry";

export type { OperatorMapBounds, OperatorMapView };

const FALLBACK_OPERATOR = "sl";

const parseCsv = (value: string | undefined): string[] => {
	if (!value) return [];
	return [...new Set(value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))];
};

export const getDefaultOperator = (): string => {
	const configured = process.env.GTFS_DEFAULT_OPERATOR?.trim().toLowerCase();
	if (!configured) return FALLBACK_OPERATOR;
	return canonicalizeOperatorSlug(configured);
};

export const getConfiguredOperators = (): string[] => {
	const configured = parseCsv(process.env.GTFS_OPERATORS);
	if (configured.length > 0) {
		return [...new Set(configured.map((x) => canonicalizeOperatorSlug(x)))];
	}
	return [getDefaultOperator()];
};

export const resolveOperator = (value: string | null | undefined): string => {
	if (!value) return getDefaultOperator();
	const normalized = canonicalizeOperatorSlug(value.trim().toLowerCase());
	if (!normalized) return getDefaultOperator();

	const allowed = getConfiguredOperators();
	return allowed.includes(normalized) ? normalized : getDefaultOperator();
};

function titleCaseUnknownOperatorSlug(slug: string): string {
	const parts = slug.split(/[-_\s]+/).filter(Boolean);
	if (parts.length === 0) return slug.toUpperCase();
	return parts
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

export function getOperatorDisplayLabel(slug: string): string {
	const key = slug.trim().toLowerCase();
	return (
		getOperatorRegistryEntryBySlug(key)?.displayLabel ??
		titleCaseUnknownOperatorSlug(key)
	);
}

export function getOperatorMapView(operator: string): OperatorMapView {
	const canonical = canonicalizeOperatorSlug(operator);
	return getOperatorRegistryEntryById(canonical)?.mapView ?? SWEDEN_FALLBACK_MAP_VIEW;
}
