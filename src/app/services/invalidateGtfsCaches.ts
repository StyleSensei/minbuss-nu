import { getConfiguredOperators } from "@/shared/config/gtfsOperators";
import { clearFeedVersionCaches } from "./dataProcessors/latestFeedVersions";

/** Tömmer feed-version-cache efter lyckad GTFS-import så nya nycklar används direkt. */
export async function invalidateGtfsCaches(): Promise<{
	clearedOperators: string[];
}> {
	const operators = getConfiguredOperators();
	await Promise.all(operators.map((operator) => clearFeedVersionCaches(operator)));
	return { clearedOperators: operators };
}
