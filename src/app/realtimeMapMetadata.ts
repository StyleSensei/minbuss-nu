import type { Metadata } from "next";
import {
	getOperatorDisplayLabel,
	resolveOperator,
} from "@shared/config/gtfsOperators";
import { getOperatorSeoArea } from "@shared/config/operatorsRegistry";
import { Paths, searchPathForOperator } from "./paths";

const SITE_ORIGIN = "https://www.minbuss.nu";

function areaLabel(operator: string): string {
	const key = operator.trim().toLowerCase();
	return getOperatorSeoArea(key) ?? getOperatorDisplayLabel(key);
}

export function siteUrlForPath(path: string): string {
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${SITE_ORIGIN}${p}`;
}

export function canonicalPathForOperator(operatorSlug: string): string {
	const op = resolveOperator(operatorSlug);
	return searchPathForOperator(op);
}

export function buildRealtimeMapPageMetadata(opts: {
	operatorSlug: string;
	linje?: string;
}): Metadata {
	const op = resolveOperator(opts.operatorSlug);
	const region = areaLabel(op);
	const linje = opts.linje?.trim();
	const canonicalPath = canonicalPathForOperator(op);

	const title = linje
		? `Busspositioner för linje ${linje} – ${region}`
		: `Sök bussar i realtid – ${region}`;
	const description = linje
		? `Se var bussar på linje ${linje} befinner sig i realtid i ${region}.`
		: `Sök och hitta bussar i ${region} i realtid med vår karttjänst.`;

	return {
		title,
		description,
		alternates: {
			canonical: siteUrlForPath(canonicalPath),
		},
	};
}

export function buildRealtimeMapJsonLd(opts: {
	operatorSlug: string;
	linje?: string;
}): object | null {
	const op = resolveOperator(opts.operatorSlug);
	const linje = opts.linje?.trim();
	if (!linje) return null;

	const region = areaLabel(op);
	const canonicalPath = canonicalPathForOperator(op);
	const offerUrl = `${siteUrlForPath(canonicalPath)}?linje=${encodeURIComponent(linje)}`;

	const isStockholm = op === "sl";

	return {
		"@context": "https://schema.org",
		"@type": "BusTrip",
		name: `Busslinje ${linje} – ${region}`,
		provider: isStockholm
			? {
					"@type": "BusCompany",
					name: "SL",
					url: "https://sl.se/",
				}
			: {
					"@type": "Organization",
					name: getOperatorDisplayLabel(op),
				},
		areaServed: isStockholm
			? {
					"@type": "City",
					name: "Stockholm",
					address: {
						"@type": "PostalAddress",
						addressLocality: "Stockholm",
						addressCountry: "SE",
					},
				}
			: {
					"@type": "AdministrativeArea",
					name: region,
					address: {
						"@type": "PostalAddress",
						addressCountry: "SE",
					},
				},
		offers: {
			"@type": "Offer",
			url: offerUrl,
		},
	};
}
