"use server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { get } from "@shared/services/serviceBase";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { formatTimestampAge } from "@/app/utilities/formatAge";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";

export interface VehiclePositionsResult {
	data: IVehiclePosition[];
	isStale?: boolean;
	timestampAge?: {
		seconds: number;
		minutes: number;
		hours?: number;
	};
}

export const getVehiclePositions =
	async (): Promise<VehiclePositionsResult> => {
		const now = Date.now();

		const url = `https://opendata.samtrafiken.se/gtfs-rt/sl/VehiclePositions.pb?key=${process.env.GTFS_REGIONAL_REALTIME}`;
		const response = await get<ArrayBuffer>(url, "arraybuffer");
		MetricsTracker.trackApiCall();

		const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
			new Uint8Array(response),
		);
		
		const timestamp = Number(feed.header.timestamp);
		const maxAge = 60 * 5; // 5 minutes
		const currentTimeSeconds = Math.floor(now / 1000);

		const vehiclePositions = feed.entity
			.map((entity) => {
				if (entity.vehicle) {
					return entity.vehicle;
				}
				return null;
			})
			.filter(Boolean) as IVehiclePosition[];

		const data = JSON.parse(JSON.stringify(vehiclePositions));

		// Kontrollera om datan är gammal
		if (timestamp + maxAge < currentTimeSeconds) {
			const ageInSeconds = currentTimeSeconds - timestamp;
			const ageInMinutes = Math.floor(ageInSeconds / 60);
			const ageInHours = Math.floor(ageInMinutes / 60);

			console.warn(
				`Using stale data that is ${formatTimestampAge({ 
					seconds: ageInSeconds, 
					minutes: ageInMinutes, 
					hours: ageInHours 
				})}`,
			);

			return {
				data,
				isStale: true,
				timestampAge: {
					seconds: ageInSeconds,
					minutes: ageInMinutes,
					hours: ageInHours > 0 ? ageInHours : undefined,
				},
			};
		}

		return { data };
	};
