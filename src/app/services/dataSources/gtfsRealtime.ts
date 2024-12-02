import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { get } from "../serviceBase";
import { use, useEffect } from "react";

interface IVehiclePosition {
	trip: {
		tripId: string | null;
		scheduleRelationship: string | null;
	};
	position: {
		latitude: number | null;
		longitude: number | null;
		bearing: number | null;
		speed: number | null;
	};
	timestamp: string | null;
	vehicle: {
		id: string | null;
	};
}

export const getVehiclePositions = async (): Promise<IVehiclePosition[]> => {
	try {
		const url = `https://opendata.samtrafiken.se/gtfs-rt/sl/VehiclePositions.pb?key=${process.env.GTFS_REGIONAL_REALTIME}`;
		const response = await get<ArrayBuffer>(url, "arraybuffer");

		// if (!response) {
		//   const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
		//   throw error;

		// }
		const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
			new Uint8Array(response),
		);
		const vehiclePositions = feed.entity
			.map((entity) => {
				if (entity.vehicle) {
					return entity.vehicle;
				}
				return null;
			})
			.filter(Boolean) as IVehiclePosition[];
		return vehiclePositions;
	} catch (error) {
		console.log(error);
		return [];
	}
};
