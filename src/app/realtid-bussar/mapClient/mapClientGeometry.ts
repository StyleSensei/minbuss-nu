import type { IShapes } from "@shared/models/IShapes";

export type ShapeGroup = {
	shape_id: string;
	points: IShapes[];
	route_short_name?: string;
};

export function isPointInBounds(
	lat: number,
	lng: number,
	bounds: { north: number; south: number; east: number; west: number },
): boolean {
	return (
		lat <= bounds.north &&
		lat >= bounds.south &&
		lng <= bounds.east &&
		lng >= bounds.west
	);
}

export function extendBoundsWithPoints(
	bounds: google.maps.LatLngBounds,
	points: IShapes[] | undefined,
): void {
	if (!points || points.length < 2) return;
	for (const p of points) {
		bounds.extend({ lat: p.shape_pt_lat, lng: p.shape_pt_lon });
	}
}

export function boundsFromLineOrRouteShapes(
	lineShapes: ShapeGroup[],
	routeShapesFallback: ShapeGroup[],
): google.maps.LatLngBounds | null {
	const bounds = new google.maps.LatLngBounds();
	for (const ls of lineShapes) {
		extendBoundsWithPoints(bounds, ls.points);
	}
	if (bounds.isEmpty()) {
		for (const s of routeShapesFallback) {
			extendBoundsWithPoints(bounds, s.points);
		}
	}
	return bounds.isEmpty() ? null : bounds;
}
