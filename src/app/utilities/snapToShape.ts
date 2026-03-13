import type { IShapes } from "@shared/models/IShapes";
import { getDistanceFromLatLon } from "./getDistanceFromLatLon";
import { projectRtToShape } from "./projectPointOnSegment";

export const snapToShapeInitial = (
	vehiclePosition: { lat: number; lng: number },
	shapePoints: IShapes[],
) => {
	if (!shapePoints.length) {
		return {
			...vehiclePosition,
			shapeIndex: 0,
			snapped: false,
			originalDistance: 0,
		};
	}

	let closestPoint = shapePoints[0];
	let minDistance = Number.MAX_VALUE;
	let closestIndex = 0;

	for (let i = 0; i < shapePoints.length; i++) {
		const distance = getDistanceFromLatLon(
			vehiclePosition.lat,
			vehiclePosition.lng,
			shapePoints[i].shape_pt_lat,
			shapePoints[i].shape_pt_lon,
		);

		if (distance < minDistance) {
			minDistance = distance;
			closestPoint = shapePoints[i];
			closestIndex = i;
		}
	}

	return {
		lat: closestPoint.shape_pt_lat,
		lng: closestPoint.shape_pt_lon,
		snapped: true,
		originalDistance: minDistance,
		shapeIndex: closestIndex,
	};
};