import { useCallback, useRef } from "react";
import type { IDbData } from "../models/IDbData";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";

export const useCheckIfFurtherFromStop = () => {
	const previousDistancesRef = useRef<Map<string, number>>(new Map());
	const passedBusesRef = useRef<Set<string>>(new Set());

	const checkIfFurtherFromStop = useCallback(
		(bus: IVehiclePosition, stop: IDbData, dependency = true) => {
			if (!bus || !stop || !dependency) return;
			const busPosition = bus?.position;
			const currentDistance = getDistanceFromLatLon(
				busPosition.latitude,
				busPosition.longitude,
				stop.stop_lat,
				stop.stop_lon,
			);
			let prevDistance: number | undefined;
			if (bus.trip.tripId) {
				prevDistance = previousDistancesRef.current.get(bus?.trip?.tripId);
				// console.log("prevDistance", prevDistance);
				if (prevDistance === undefined || currentDistance < prevDistance) {
					// console.log(`bus ${bus.trip.tripId} is getting closer to the stop`);
					previousDistancesRef.current.set(bus.trip.tripId, currentDistance);
					return false;
				}
				// if (currentDistance > prevDistance) {
				// 	// console.log(
				// 	// 	`bus ${bus.trip.tripId} is getting further from the stop`,
				// 	// );
				// 	// previousDistancesRef.current.set(bus.trip.tripId, currentDistance);

				// 	passedBusesRef.current.add(bus.trip.tripId);
				// 	return false;
				// }
				// if (currentDistance === prevDistance) {
				// 	// console.log(`bus ${bus.trip.tripId} is at the same distance`);
				// 	return true;
				// }
				return true;
			}
		},
		[],
	);
	return checkIfFurtherFromStop;
};
