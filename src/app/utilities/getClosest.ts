import type { IDbData } from "../models/IDbData";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import { getDistanceFromLatLon } from "./getDistanceFromLatLon";

export const getClosest = (
	list: IDbData[] | IVehiclePosition[],
	latitude: number,
	longitude: number,
) => {
	const closest = list.reduce((prev, current) => {
		const prevLat = "stop_id" in prev ? prev.stop_lat : prev.position.latitude;
		const prevLon = "stop_id" in prev ? prev.stop_lon : prev.position.longitude;
		const currentLat =
			"stop_id" in current ? current.stop_lat : current.position.latitude;
		const currentLon =
			"stop_id" in current ? current.stop_lon : current.position.longitude;
		const prevDistance = getDistanceFromLatLon(
			latitude,
			longitude,
			prevLat,
			prevLon,
		);
		const currentDistance = getDistanceFromLatLon(
			latitude,
			longitude,
			currentLat,
			currentLon,
		);
		return currentDistance < prevDistance ? current : prev;
	});
	return closest;
};
