"use server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { get } from "../serviceBase";

export interface IVehiclePosition {
	trip: {
		tripId: string | null;
		scheduleRelationship: string | null;
	};
	position: {
		latitude: number;
		longitude: number;
		bearing: number | null;
		speed: number | null;
	};
	timestamp: string | null;
	vehicle: {
		id: string;
	};
}

export const getVehiclePositions = async (): Promise<IVehiclePosition[]> => {
	try {
		const url = `https://opendata.samtrafiken.se/gtfs-rt/sl/VehiclePositions.pb?key=${process.env.GTFS_REGIONAL_REALTIME}`;
		const response = await get<ArrayBuffer>(url, "arraybuffer");

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
		const data = JSON.parse(JSON.stringify(vehiclePositions));
		return data;
	} catch (error) {
		console.log(error);
		return [];
	}
};
