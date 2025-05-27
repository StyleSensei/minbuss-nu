"use server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { get } from "../serviceBase";
import { redis } from "@/app/utilities/redis";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";
import { formatTimestampAge } from "@/app/utilities/formatAge";

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

const API_LOCK_KEY = "vehicle-positions-api-lock";
const API_LOCK_TTL = 10; // 10 sek

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

		const cachedResult = await redis.get("api-call-result");
		MetricsTracker.trackRedisOperation();

		if (cachedResult && Array.isArray(cachedResult)) {
			MetricsTracker.trackCacheHit();
			return { data: cachedResult as IVehiclePosition[] };
		}

		const pipeline = redis.pipeline();
		pipeline.get("last-api-call-time");
		pipeline.set(API_LOCK_KEY, "locked", {
			nx: true, // Only set if key doesn't exist
			ex: API_LOCK_TTL,
		});

		const [lastCallTimeRes, lockAcquiredRes] = await pipeline.exec();
		const lastCallTime =
			lastCallTimeRes && !Number.isNaN(lastCallTimeRes)
				? Number(lastCallTimeRes)
				: 0;
		const lockAcquired = lockAcquiredRes === "OK" || lockAcquiredRes === 1;

		if (now - lastCallTime < 2000) {
			// Throttling API-anrop - för täta anrop

			if (lockAcquired) {
				await redis.del(API_LOCK_KEY);
			}

			await new Promise((resolve) => setTimeout(resolve, 300));

			// Någon annan tråd kan ha slutfört anropet under tiden vi väntade
			const retryCache = await redis.get("api-call-result");
			if (retryCache && Array.isArray(retryCache)) {
				return { data: retryCache };
			}
		}

		if (!lockAcquired) {
			await new Promise((resolve) => setTimeout(resolve, 500));

			const lockRetryCache = await redis.get("api-call-result");
			if (lockRetryCache && Array.isArray(lockRetryCache)) {
				return { data: lockRetryCache };
			}
		}

		let data: IVehiclePosition[] = [];

		try {
			await redis.set("last-api-call-time", now.toString(), { ex: 30 });
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

			data = JSON.parse(JSON.stringify(vehiclePositions));
			await redis.set("api-call-result", data, { ex: 3 });

			if (timestamp + maxAge < currentTimeSeconds) {
				const ageInSeconds = currentTimeSeconds - timestamp;
				const ageInMinutes = Math.floor(ageInSeconds / 60);
				const ageInHours = Math.floor(ageInMinutes / 60);

				console.warn(
					`Using stale data that is ${formatTimestampAge({ seconds: ageInSeconds, minutes: ageInMinutes, hours: ageInHours })}`,
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
		} catch (error) {
			console.error("Error fetching vehicle positions:", error);

			throw error;
		} finally {
			if (lockAcquired) {
				await redis.del(API_LOCK_KEY);
			}
		}
	};
