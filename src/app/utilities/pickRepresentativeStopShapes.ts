export interface IStopBoardShapeRef {
	route_short_name: string;
	route_type: number | null;
	shape_id: string;
	direction_id?: number | null;
	occurrenceCount?: number;
}

export function stopBoardShapeRouteKey(shape: IStopBoardShapeRef): string {
	return `${shape.route_type ?? "unknown"}:${shape.route_short_name}:${shape.direction_id ?? "any"}`;
}

/**
 * One polyline per line and direction. Rank by caller-supplied score
 * (trip occurrences at the stop) so short-turns lose without scanning
 * the shapes table.
 */
export function pickRepresentativeStopBoardShapeRefs<
	T extends IStopBoardShapeRef,
>(shapeRefs: T[], lengthByShapeId: Map<string, number>): T[] {
	const best = new Map<string, { ref: T; length: number }>();
	for (const ref of shapeRefs) {
		const key = stopBoardShapeRouteKey(ref);
		const length = lengthByShapeId.get(ref.shape_id) ?? 0;
		const current = best.get(key);
		if (!current || length > current.length) {
			best.set(key, { ref, length });
		}
	}
	return [...best.values()].map((entry) => entry.ref);
}

/** Busiest lines first so knutpunkter can paint metro/trunk routes before outer lines. */
export function sortStopBoardShapeRefsByOccurrence<
	T extends { occurrenceCount?: number },
>(refs: T[]): T[] {
	return [...refs].sort(
		(a, b) => (b.occurrenceCount ?? 0) - (a.occurrenceCount ?? 0),
	);
}
