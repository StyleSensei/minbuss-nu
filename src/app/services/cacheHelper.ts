"use server";
import type { IDbData } from "@shared/models/IDbData";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { cache } from "react";
import {
	getDefaultOperator,
	resolveOperator,
} from "@/shared/config/gtfsOperators";
import type { IShapes } from "@/shared/models/IShapes";
import type { IStopBoardShape } from "@/shared/models/IStopBoardShape";
import type { ITripData } from "../context/DataContext";
import {
	compactLineShapes,
	compactStopBoardShapes,
	expandLineShapes,
	expandStopBoardShapes,
	type ICompactLineShape,
	type ICompactStopBoardShape,
} from "../utilities/compactStopBoardShapes";
import { MetricsTracker } from "../utilities/MetricsTracker";
import { pickRepresentativeStopBoardShapeRefs } from "../utilities/pickRepresentativeStopShapes";
import { redis } from "../utilities/redis";
import { selectLatestFeedVersionTexts } from "./dataProcessors/latestFeedVersions";
import type { IStopDepartureSchedule } from "./dataProcessors/selectFromDatabase";
import {
	selectActiveTripIdsForLineFromDatabase,
	selectDistinctShapeIdsForLineFromDatabase,
	selectDistinctShapesForStopFromDatabase,
	selectDistinctStopsForLineFromDatabase,
	selectShapesForIdsFromDatabase,
	selectShapesFromDatabase,
	selectTripMarkerMetaForTripIdsFromDatabase,
	selectTripStopsFromDatabase,
	selectUpcomingDeparturesForStopFromDatabase,
	selectUpcomingTripsFromDatabase,
} from "./dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "./dataSources/gtfsRealtime";
import { getTripUpdates } from "./dataSources/gtfsTripUpdates";

interface VehiclePositionResult {
	data: IVehiclePosition[];
	error?: IError;
}
export interface IError {
	type: "API_ERROR" | "DATA_TOO_OLD" | "OTHER" | "LOCK_ERROR" | "TIMEOUT_ERROR";
	message: string;
	timestampAge?: ITimestampAge;
	isStale?: boolean;
}
interface ITimestampAge {
	seconds: number;
	minutes: number;
	hours?: number;
}

interface DataTooOldError extends Error {
	timestampAge?: ITimestampAge;
}

const VEHICLE_POSITIONS_CACHE_KEY = "vehicle-positions-cache";
const TRIP_UPDATES_CACHE_KEY = "trip-updates-cache";
const TRIP_UPDATES_LOCK_KEY = "trip-updates-lock";

// TTL i sekunder
const REALTIME_TTL = 4;
const STOP_DEPARTURES_TTL = 60;
const STOP_SHAPES_TTL = 60 * 60 * 24;
const LINE_SHAPES_TTL = STOP_SHAPES_TTL;
const LOCK_TTL = 4;
const LOCK_RETRY_DELAY = 100;
const LOCK_MAX_RETRIES = 10;
const VEHICLE_LOCK_KEY = "vehicle-positions-lock";

const vehiclePositionsCacheKey = (operator: string) =>
	`${VEHICLE_POSITIONS_CACHE_KEY}:${operator}`;
const tripUpdatesCacheKey = (operator: string) =>
	`${TRIP_UPDATES_CACHE_KEY}:${operator}`;
const tripUpdatesLockKey = (operator: string) =>
	`${TRIP_UPDATES_LOCK_KEY}:${operator}`;
const vehicleLockKey = (operator: string) => `${VEHICLE_LOCK_KEY}:${operator}`;

export const getCachedVehiclePositions = cache(
	async (
		operatorInput = getDefaultOperator(),
	): Promise<VehiclePositionResult> => {
		const operator = resolveOperator(operatorInput);
		const cacheKey = vehiclePositionsCacheKey(operator);
		const lockKey = vehicleLockKey(operator);
		const cached = await redis.get(cacheKey);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as VehiclePositionResult;
		}
		const lockAcquired = await redis.set(lockKey, "locked", {
			nx: true,
			ex: LOCK_TTL,
		});

		if (!lockAcquired) {
			return await waitForCachedData(cacheKey);
		}

		try {
			MetricsTracker.trackCacheMiss();
			const response = await getVehiclePositions(operator);

			if (response.isStale && response.timestampAge) {
				const result: VehiclePositionResult = {
					data: response.data,
					error: {
						type: "DATA_TOO_OLD",
						message: "Saknar aktuell realtidsdata",
						timestampAge: response.timestampAge,
						isStale: response.isStale,
					},
				};

				await redis.set(cacheKey, result, {
					ex: REALTIME_TTL,
				});
				return result;
			}

			// Normal case - fresh data
			const result: VehiclePositionResult = { data: response.data };
			await redis.set(cacheKey, result, {
				ex: REALTIME_TTL,
			});
			return result;
		} catch (error) {
			console.error("Error fetching vehicle positions:", error);
			if (error instanceof Error) {
				if (error.name === "DataTooOld") {
					const dataError = error as unknown as DataTooOldError;
					return {
						data: [],
						error: {
							type: "DATA_TOO_OLD",
							message: "Aktuell realtidsdata saknas",
							timestampAge: dataError.timestampAge,
						},
					};
				}
				return {
					data: [],
					error: {
						type: "API_ERROR",
						message: "Kunde inte hämta realtidsdata",
					},
				};
			}
			return {
				data: [],
				error: {
					type: "OTHER",
					message: "Ett okänt fel uppstod",
				},
			};
		} finally {
			await redis.del(lockKey);
		}
	},
);

async function waitForCachedData(
	cacheKey: string,
): Promise<VehiclePositionResult> {
	for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
		await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY));

		const cached = await redis.get(cacheKey);
		if (cached) {
			return cached as VehiclePositionResult;
		}
	}

	return {
		data: [],
		error: {
			message: "Timeout waiting for vehicle data",
			type: "TIMEOUT_ERROR",
		},
	};
}

export const getCachedTripUpdates = cache(
	async (operatorInput = getDefaultOperator()) => {
		const operator = resolveOperator(operatorInput);
		const cacheKey = tripUpdatesCacheKey(operator);
		const lockKey = tripUpdatesLockKey(operator);
		const cached = await redis.get(cacheKey);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as ITripUpdate[];
		}

		const lockAcquired = await redis.set(lockKey, "locked", {
			nx: true,
			ex: LOCK_TTL,
		});

		if (!lockAcquired) {
			return await waitForCachedTripUpdates(cacheKey);
		}

		try {
			MetricsTracker.trackCacheMiss();
			const data = await getTripUpdates(operator);
			await redis.set(cacheKey, data, { ex: REALTIME_TTL });
			MetricsTracker.trackRedisOperation();
			return data;
		} catch (error) {
			console.error("Error fetching trip updates:", error);
			return [];
		} finally {
			await redis.del(lockKey);
		}
	},
);

async function waitForCachedTripUpdates(
	cacheKey: string,
): Promise<ITripUpdate[]> {
	for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
		await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY));

		const cached = await redis.get(cacheKey);
		if (cached) {
			return cached as ITripUpdate[];
		}
	}

	return [];
}

function lineShapeCacheKey(operator: string, shapeId: string) {
	return `line-shape:v2:${operator}:${shapeId}`;
}

async function getLineShapesForTrips(
	trips: IDbData[],
	operator: string,
): Promise<{ shape_id: string; points: IShapes[] }[]> {
	const seen = new Set<string>();
	const shapeIds: string[] = [];
	for (const t of trips) {
		if (t.shape_id && !seen.has(t.shape_id)) {
			seen.add(t.shape_id);
			shapeIds.push(t.shape_id);
		}
	}
	if (!shapeIds.length) return [];

	const loaded: { shape_id: string; points: IShapes[] }[] = [];
	const missing: string[] = [];
	for (const shapeId of shapeIds) {
		const cached = await redis.get(lineShapeCacheKey(operator, shapeId));
		if (cached) {
			MetricsTracker.trackCacheHit();
			loaded.push(...expandLineShapes([cached as ICompactLineShape]));
		} else {
			missing.push(shapeId);
		}
	}
	if (!missing.length) return loaded;

	MetricsTracker.trackCacheMiss();
	const feedVersions = [
		...new Set(trips.map((trip) => trip.feed_version).filter(Boolean)),
	];
	let allPoints = await selectShapesForIdsFromDatabase(
		missing,
		operator,
		feedVersions,
	);
	if (!allPoints.length && feedVersions.length) {
		allPoints = await selectShapesForIdsFromDatabase(missing, operator);
	}
	const pointsByShapeId = new Map<string, IShapes[]>();
	for (const point of allPoints) {
		const existing = pointsByShapeId.get(point.shape_id);
		if (existing) {
			existing.push(point);
		} else {
			pointsByShapeId.set(point.shape_id, [point]);
		}
	}
	for (const shapeId of missing) {
		const points = pointsByShapeId.get(shapeId);
		if (!points?.length) continue;
		const compact = compactLineShapes([{ shape_id: shapeId, points }])[0];
		await redis.set(lineShapeCacheKey(operator, shapeId), compact, {
			ex: LINE_SHAPES_TTL,
		});
		MetricsTracker.trackRedisOperation();
		loaded.push(...expandLineShapes([compact]));
	}
	return loaded;
}

async function resolveLineTripIdsForMarkerMeta(
	busLine: string,
	operator: string,
	clientTripIds?: string[],
): Promise<string[]> {
	const fromClient = [
		...new Set(
			(clientTripIds ?? [])
				.map((tripId) => tripId?.trim())
				.filter((tripId): tripId is string => Boolean(tripId)),
		),
	];
	let activeTripIds = fromClient;
	if (!activeTripIds.length) {
		const cachedVehiclePositions = await getCachedVehiclePositions(operator);
		activeTripIds = [
			...new Set(
				cachedVehiclePositions.data
					.map((vehicle) => vehicle.trip?.tripId)
					.filter((tripId): tripId is string => Boolean(tripId)),
			),
		];
	}
	if (!activeTripIds.length) return [];
	return selectActiveTripIdsForLineFromDatabase(
		busLine,
		activeTripIds,
		operator,
	);
}

async function enrichCurrentTripsWithMarkerMeta(
	busLine: string,
	operator: string,
	currentTrips: IDbData[],
	clientTripIds?: string[],
): Promise<IDbData[]> {
	const lineTripIds = await resolveLineTripIdsForMarkerMeta(
		busLine,
		operator,
		clientTripIds,
	);
	if (!lineTripIds.length) return currentTrips;

	const coveredTripIds = new Set(
		currentTrips.map((trip) => trip.trip_id).filter(Boolean),
	);
	const missingTripIds = lineTripIds.filter((tripId) => !coveredTripIds.has(tripId));
	if (!missingTripIds.length) return currentTrips;

	const markerMeta = await selectTripMarkerMetaForTripIdsFromDatabase(
		busLine,
		missingTripIds,
		operator,
	);
	if (!markerMeta.length) {
		return currentTrips.length > 0 ? currentTrips : markerMeta;
	}
	return [...currentTrips, ...markerMeta];
}

export const getCachedDbData = cache(
	async (
		busLine: string,
		busStopName?: string,
		operatorInput = getDefaultOperator(),
		clientTripIds?: string[],
		mode: "full" | "meta" | "shapes" = "full",
	) => {
		const operator = resolveOperator(operatorInput);
		let currentTrips: IDbData[] = [];
		let upcomingTrips: IDbData[] = [];
		let lineStops: IDbData[] = [];

		const trimmedStopName = busStopName?.trim() || undefined;
		const tripIdsForLine = clientTripIds?.length ? clientTripIds : undefined;
		const skipShapes = mode === "meta";
		const skipStops = mode === "meta";

		if (trimmedStopName) {
			MetricsTracker.trackDbQuery();
			upcomingTrips = await selectUpcomingTripsFromDatabase(
				busLine,
				trimmedStopName,
				operator,
			);
		} else {
			MetricsTracker.trackDbQuery();
			currentTrips = await enrichCurrentTripsWithMarkerMeta(
				busLine,
				operator,
				[],
				tripIdsForLine,
			);
			if (!skipStops) {
				lineStops = await selectDistinctStopsForLineFromDatabase(
					busLine,
					operator,
				);
			}
		}

		const tripsForShapes = [...currentTrips, ...upcomingTrips];
		let lineShapes: { shape_id: string; points: IShapes[] }[] = [];
		if (!skipShapes) {
			lineShapes = await getLineShapesForTrips(tripsForShapes, operator);
			if (!lineShapes.length && !trimmedStopName) {
				const shapeIds = await selectDistinctShapeIdsForLineFromDatabase(
					busLine,
					operator,
				);
				const fallbackTrips = shapeIds.map((shape_id) => ({
					operator,
					trip_id: "",
					shape_id,
					route_short_name: busLine,
					stop_headsign: "",
					stop_id: "",
					departure_time: "",
					stop_name: "",
					stop_sequence: 0,
					stop_lat: 0,
					stop_lon: 0,
					feed_version: "",
				}));
				lineShapes = await getLineShapesForTrips(fallbackTrips, operator);
			}
		}

		return { currentTrips, upcomingTrips, lineStops, lineShapes } as ITripData;
	},
);

export const getCachedStopDepartures = cache(
	async (
		stopId: string,
		operatorInput = getDefaultOperator(),
	): Promise<IStopDepartureSchedule> => {
		const operator = resolveOperator(operatorInput);
		const minuteBucket = Math.floor(Date.now() / 60000);
		const cacheKey = `stop-departures:v10:${operator}:${stopId}:${minuteBucket}`;
		const cached = await redis.get(cacheKey);
		if (cached) {
			MetricsTracker.trackCacheHit();
			return cached as IStopDepartureSchedule;
		}

		MetricsTracker.trackCacheMiss();
		const result = await selectUpcomingDeparturesForStopFromDatabase(
			stopId,
			operator,
		);
		await redis.set(cacheKey, result, { ex: STOP_DEPARTURES_TTL });
		MetricsTracker.trackRedisOperation();
		return result;
	},
);

export async function getCachedStopShapes(
	stopId: string,
	operatorInput = getDefaultOperator(),
): Promise<IStopBoardShape[]> {
	const operator = resolveOperator(operatorInput);
	const feed = await selectLatestFeedVersionTexts(operator);
	const cacheKey = `stop-shapes:v10:${operator}:${stopId}:${feed.trips}:${feed.shapes}`;
	const cached = await redis.get(cacheKey);
	if (cached) {
		MetricsTracker.trackCacheHit();
		return expandStopBoardShapes(cached as ICompactStopBoardShape[]);
	}

	MetricsTracker.trackCacheMiss();
	const shapeRefs = await selectDistinctShapesForStopFromDatabase(
		stopId,
		operator,
	);
	const lengthByShapeId = new Map<string, number>();
	for (const shape of shapeRefs) {
		lengthByShapeId.set(
			shape.shape_id,
			(lengthByShapeId.get(shape.shape_id) ?? 0) +
				(shape.occurrenceCount ?? 0),
		);
	}
	const representativeShapeRefs = pickRepresentativeStopBoardShapeRefs(
		shapeRefs,
		lengthByShapeId,
	);
	const allPoints = await selectShapesForIdsFromDatabase(
		representativeShapeRefs.map((shape) => shape.shape_id),
		operator,
	);
	const pointsByShapeId = new Map<string, IShapes[]>();
	for (const point of allPoints) {
		const existing = pointsByShapeId.get(point.shape_id);
		if (existing) {
			existing.push(point);
		} else {
			pointsByShapeId.set(point.shape_id, [point]);
		}
	}
	const shapes: IStopBoardShape[] = representativeShapeRefs.flatMap((shape) => {
		const points = pointsByShapeId.get(shape.shape_id);
		return points?.length
			? [
					{
						route_short_name: shape.route_short_name,
						route_type: shape.route_type,
						shape_id: shape.shape_id,
						points,
					},
				]
			: [];
	});
	const compactShapes = compactStopBoardShapes(shapes);
	await redis.set(cacheKey, compactShapes, { ex: STOP_SHAPES_TTL });
	MetricsTracker.trackRedisOperation();
	return expandStopBoardShapes(compactShapes);
}

export const getCachedTripStops = cache(
	async (tripId: string, operatorInput = getDefaultOperator()) => {
		const operator = resolveOperator(operatorInput);
		return selectTripStopsFromDatabase(tripId, operator);
	},
);

export const getCachedShapesData = cache(
	async (
		_feedVersion: string,
		shapeId: string,
		operatorInput = getDefaultOperator(),
	) => {
		const operator = resolveOperator(operatorInput);
		MetricsTracker.trackDbQuery();
		const shapePoints = await selectShapesFromDatabase(shapeId, operator);
		return shapePoints;
	},
);

MetricsTracker.enableLogging(false);
