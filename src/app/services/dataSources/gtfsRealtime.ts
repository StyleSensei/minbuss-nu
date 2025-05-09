"use server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { get } from "../serviceBase";
import { redis } from "@/app/utilities/redis";
import { MetricsTracker } from "@/app/utilities/MetricsTracker";

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

export const getVehiclePositions = async (): Promise<IVehiclePosition[]> => {
	const now = Date.now();

	const cachedResult = await redis.get("api-call-result");
	MetricsTracker.trackRedisOperation();

	if (cachedResult && Array.isArray(cachedResult)) {
		MetricsTracker.trackCacheHit();
		return cachedResult as IVehiclePosition[];
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
			return retryCache as IVehiclePosition[];
		}
	}

	if (!lockAcquired) {
		await new Promise((resolve) => setTimeout(resolve, 500));

		const lockRetryCache = await redis.get("api-call-result");
		if (lockRetryCache && Array.isArray(lockRetryCache)) {
			return lockRetryCache as IVehiclePosition[];
		}
	}

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

		if (timestamp + maxAge < now / 1000) {
			const error = new Error("Real-time data is too old");
			error.name = "DataTooOld";
			throw error;
		}

		const vehiclePositions = feed.entity
			.map((entity) => {
				if (entity.vehicle) {
					return entity.vehicle;
				}
				return null;
			})
			.filter(Boolean) as IVehiclePosition[];

		await redis.set("api-call-result", vehiclePositions, {
			ex: 3,
		});
		const data = JSON.parse(JSON.stringify(vehiclePositions));
		return data;
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "DataTooOld") {
				console.error("Real-time data is too old");
				throw error;
			}
		} else {
			console.log("unknown error fetching vehicle positions", error);
		}
		return [];
	} finally {
		if (lockAcquired) {
			await redis.del(API_LOCK_KEY);
		}
	}
};
