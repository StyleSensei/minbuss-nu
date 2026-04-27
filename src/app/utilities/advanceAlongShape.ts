import type { IShapes } from "@/shared/models/IShapes";
import { getDistanceFromLatLon } from "./getDistanceFromLatLon";

/**
 * Moves forward along a polyline by `distanceM` meters from segment `(startIndex, startT)`.
 * Monotonic forward only; clamps at line end.
 */
export function advanceAlongShapePoints(
	shapePoints: IShapes[],
	startIndex: number,
	startT: number,
	distanceM: number,
): { lat: number; lng: number; index: number; t: number } {
	if (shapePoints.length < 2 || distanceM <= 0) {
		const p = shapePoints[Math.min(Math.max(0, startIndex), shapePoints.length - 1)];
		return {
			lat: p.shape_pt_lat,
			lng: p.shape_pt_lon,
			index: Math.max(0, Math.min(shapePoints.length - 2, startIndex)),
			t: Math.max(0, Math.min(1, startT)),
		};
	}

	let i = Math.min(Math.max(0, startIndex), shapePoints.length - 2);
	let t = Math.max(0, Math.min(1, startT));
	let remaining = distanceM;
	const maxSteps = shapePoints.length + 4;
	let steps = 0;

	while (remaining > 0.05 && steps < maxSteps) {
		steps++;
		const a = shapePoints[i];
		const b = shapePoints[i + 1];
		const segLen = getDistanceFromLatLon(
			a.shape_pt_lat,
			a.shape_pt_lon,
			b.shape_pt_lat,
			b.shape_pt_lon,
		);
		if (segLen < 0.5) {
			if (i >= shapePoints.length - 2) break;
			i++;
			t = 0;
			continue;
		}
		const aheadOnSegment = (1 - t) * segLen;
		if (remaining <= aheadOnSegment) {
			const deltaT = remaining / segLen;
			const newT = Math.min(1, t + deltaT);
			return {
				lat: a.shape_pt_lat + (b.shape_pt_lat - a.shape_pt_lat) * newT,
				lng: a.shape_pt_lon + (b.shape_pt_lon - a.shape_pt_lon) * newT,
				index: i,
				t: newT,
			};
		}
		remaining -= aheadOnSegment;
		if (i >= shapePoints.length - 2) {
			return {
				lat: b.shape_pt_lat,
				lng: b.shape_pt_lon,
				index: shapePoints.length - 2,
				t: 1,
			};
		}
		i++;
		t = 0;
	}

	const end = shapePoints[shapePoints.length - 1];
	return {
		lat: end.shape_pt_lat,
		lng: end.shape_pt_lon,
		index: shapePoints.length - 2,
		t: 1,
	};
}
