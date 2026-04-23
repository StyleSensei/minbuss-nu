import type { IDbData } from "@shared/models/IDbData";

export type StopWithRoutesRow = {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	routes: string[];
};

export function mergeDuplicateStopsByName(
	stops: StopWithRoutesRow[],
): StopWithRoutesRow[] {
	const byName = new Map<string, StopWithRoutesRow>();
	for (const row of stops) {
		const key = row.stop_name.trim().toLowerCase();
		const prev = byName.get(key);
		if (!prev) {
			byName.set(key, {
				...row,
				routes: [...row.routes],
			});
			continue;
		}
		const routeSet = new Set<string>([...prev.routes, ...row.routes]);
		byName.set(key, {
			...prev,
			routes: [...routeSet].sort((a, b) => a.localeCompare(b, "sv")),
		});
	}
	return [...byName.values()];
}

export function stopRowToDbData(row: StopWithRoutesRow): IDbData {
	return {
		trip_id: "",
		shape_id: "",
		route_short_name: "",
		stop_headsign: "",
		stop_id: row.stop_id,
		departure_time: "",
		stop_name: row.stop_name,
		stop_sequence: 0,
		stop_lat: row.stop_lat,
		stop_lon: row.stop_lon,
		feed_version: "",
	};
}

export function isLikelyLineNumberQuery(trimmed: string): boolean {
	return /\d/.test(trimmed);
}
