import type { IDbData } from "@shared/models/IDbData";

export type StopWithRoutesRow = {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	location_type?: number;
	parent_station?: string | null;
	platform_code?: string | null;
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
			const stationStopId = row.parent_station?.trim() || row.stop_id;
			byName.set(key, {
				...row,
				stop_id: stationStopId,
				location_type: row.parent_station ? 1 : row.location_type,
				platform_code: row.parent_station ? null : row.platform_code,
				routes: [...row.routes],
			});
			continue;
		}
		const routeSet = new Set<string>([...prev.routes, ...row.routes]);
		byName.set(key, {
			...prev,
			stop_id:
				prev.parent_station?.trim() ||
				row.parent_station?.trim() ||
				prev.stop_id,
			location_type:
				prev.parent_station || row.parent_station ? 1 : prev.location_type,
			platform_code:
				prev.parent_station || row.parent_station ? null : prev.platform_code,
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
		platform_code: row.platform_code,
		stop_sequence: 0,
		stop_lat: row.stop_lat,
		stop_lon: row.stop_lon,
		feed_version: "",
	};
}

export function isLikelyLineNumberQuery(trimmed: string): boolean {
	return /\d/.test(trimmed);
}
