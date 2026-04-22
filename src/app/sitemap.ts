import type { MetadataRoute } from "next";
import { getConfiguredOperators } from "@shared/config/gtfsOperators";
import { getRegionPathSlugForOperator } from "@shared/config/realtimeRegionPaths";
import { Paths, REALTID_BUS_PATH_PREFIX } from "./paths";

const BASE = "https://www.minbuss.nu";

export default function sitemap(): MetadataRoute.Sitemap {
	const configured = getConfiguredOperators();
	const regionPaths = new Set<string>();
	for (const op of configured) {
		regionPaths.add(
			`${REALTID_BUS_PATH_PREFIX}${getRegionPathSlugForOperator(op)}`,
		);
	}

	const entries: MetadataRoute.Sitemap = [
		{
			url: `${BASE}/`,
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${BASE}${Paths.About}`,
			changeFrequency: "monthly",
			priority: 0.8,
		},
	];

	for (const path of regionPaths) {
		entries.push({
			url: `${BASE}${path}`,
			changeFrequency: "monthly",
			priority: 0.8,
		});
	}

	return entries;
}
