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
	async (operator: string): Promise<VehiclePositionsResult> => {
		const now = Date.now();

		const url = `https://opendata.samtrafiken.se/gtfs-rt/${operator}/VehiclePositions.pb?key=${process.env.GTFS_REGIONAL_REALTIME}`;
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
				const raw = entity.vehicle;
				if (!raw) return null;

				const trip = raw.trip;
				const pos = raw.position;
				const vehicle = raw.vehicle;

				return {
					trip: {
						tripId: trip?.tripId ?? null,
						scheduleRelationship:
							trip?.scheduleRelationship != null
								? String(trip.scheduleRelationship)
								: null,
					},
					position: {
						latitude: pos?.latitude ?? 0,
						longitude: pos?.longitude ?? 0,
						bearing: pos?.bearing ?? null,
						speed: pos?.speed ?? null,
					},
					timestamp:
						raw.timestamp != null && Number.isFinite(Number(raw.timestamp))
							? String(raw.timestamp)
							: null,
					vehicle: {
						id: vehicle?.id ?? "",
					},
				} satisfies IVehiclePosition;
			})
			.filter((v): v is IVehiclePosition => v != null);

		const data = vehiclePositions;

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
