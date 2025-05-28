import { useCallback, useRef } from "react";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import type { IDbData } from "@shared/models/IDbData";

export const useCheckIfFurtherFromStop = () => {
	const previousDistancesRef = useRef<Map<string, number>>(new Map());
	const movingAwayCountRef = useRef<Map<string, number>>(new Map());
	const DISTANCE_THRESHOLD = 7;
	const CONSECUTIVE_CHECKS = 2;

	const checkIfFurtherFromStop = useCallback(
		(bus: IVehiclePosition, stop: IDbData, dependency = true) => {
			if (!bus || !stop || !dependency) return false;

			const busPosition = bus?.position;
			const currentDistance = getDistanceFromLatLon(
				busPosition.latitude,
				busPosition.longitude,
				stop.stop_lat,
				stop.stop_lon,
			);

			if (bus.trip.tripId) {
				const prevDistance = previousDistancesRef.current.get(bus.trip.tripId);
				let movingAwayCount =
					movingAwayCountRef.current.get(bus.trip.tripId) || 0;

				if (prevDistance === undefined) {
					previousDistancesRef.current.set(bus.trip.tripId, currentDistance);
					return false;
				}

				const distanceChange = currentDistance - prevDistance;

				if (distanceChange > DISTANCE_THRESHOLD) {
					movingAwayCount++;
					movingAwayCountRef.current.set(bus.trip.tripId, movingAwayCount);
				} else if (distanceChange < -DISTANCE_THRESHOLD) {
					movingAwayCount = 0;
					movingAwayCountRef.current.set(bus.trip.tripId, 0);
				}

				if (Math.abs(distanceChange) > DISTANCE_THRESHOLD) {
					previousDistancesRef.current.set(bus.trip.tripId, currentDistance);
				}

				return movingAwayCount >= CONSECUTIVE_CHECKS;
			}

			return false;
		},
		[],
	);

	return checkIfFurtherFromStop;
};
