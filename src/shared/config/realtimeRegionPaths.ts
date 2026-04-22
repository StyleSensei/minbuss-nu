import {
	canonicalizeOperatorSlug,
	OPERATOR_REGISTRY,
} from "./operatorsRegistry";

/**
 * Kanoniska regionssegment i URL:en under `/realtid-bussar/[region]`.
 * Varje konfigurerad GTFS-operatör mappas till ett stabilt slug (inte visningsnamn).
 */
export const OPERATOR_TO_REGION_PATH: Record<string, string> =
	OPERATOR_REGISTRY.reduce(
		(acc, entry) => {
			acc[entry.id] = entry.regionSlug;
			for (const alias of entry.aliases) {
				acc[alias] = entry.regionSlug;
			}
			return acc;
		},
		{} as Record<string, string>,
	);

/** Första operatörsslug per regions-URL (SEO/kanon). */
export const REGION_PATH_TO_OPERATOR: Record<string, string> =
	OPERATOR_REGISTRY.reduce(
		(acc, entry) => {
			if (!acc[entry.regionSlug]) {
				acc[entry.regionSlug] = entry.id;
			}
			return acc;
		},
		{} as Record<string, string>,
	);

export function getRegionPathSlugForOperator(operator: string): string {
	const k = canonicalizeOperatorSlug(operator.trim().toLowerCase());
	return OPERATOR_TO_REGION_PATH[k] ?? k;
}

/**
 * Slår regionssegment + vilka operatörer som är aktiva i miljön → en operatörsslug.
 */
export function resolveOperatorFromRegionPathWithConfig(
	regionPath: string,
	configured: string[],
): string | null {
	const r = regionPath.trim().toLowerCase();
	if (!r) return null;
	const configuredCanonical = [...new Set(configured.map(canonicalizeOperatorSlug))];

	const preferred = REGION_PATH_TO_OPERATOR[r];
	if (preferred && configuredCanonical.includes(preferred)) {
		return preferred;
	}

	for (const op of configuredCanonical) {
		if (getRegionPathSlugForOperator(op) === r) {
			return op;
		}
	}

	const normalizedRegionAsOperator = canonicalizeOperatorSlug(r);
	if (configuredCanonical.includes(normalizedRegionAsOperator)) {
		return normalizedRegionAsOperator;
	}

	return null;
}
