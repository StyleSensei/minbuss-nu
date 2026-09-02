import type { IShapes } from "@/shared/models/IShapes";
import { advanceAlongShapePoints } from "./advanceAlongShape";
import { projectRtToShape } from "./projectPointOnSegment";
import { getDistanceFromLatLon } from "./getDistanceFromLatLon";

/** Used when vehicle timestamp is missing (Redis TTL + poll interval). */
export const DEFAULT_PIPELINE_LATENCY_SEC = 2.5;
/** Small buffer for cache/poll when a vehicle timestamp is present. */
export const TIMESTAMP_PIPELINE_BUFFER_SEC = 0.8;
export const MAX_EXTRAPOLATION_AGE_SEC = 8;
export const MAX_EXTRAPOLATION_DISTANCE_M = 55;
export const MIN_MOVING_SPEED_MPS = 0.3;
export const MAX_SPEED_MPS = 28;
/** Max drift from reported GPS while cruising between samples. */
export const MAX_CRUISE_DRIFT_FROM_GPS_M = 45;

export function parseVehicleTimestampSec(
	timestamp: string | null | undefined,
): number | null {
	if (timestamp == null || timestamp === "") return null;
	const n = Number(timestamp);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n > 1e12 ? n / 1000 : n;
}

/**
 * Age since the position was valid — anchored to when we received the sample,
 * not an arbitrarily stale vehicle timestamp that would over-extrapolate.
 */
export function computeSampleAgeSec(options: {
	nowMs: number;
	sampleTimestampSec: number | null;
	receivedAtMs: number | null;
	pipelineLatencySec?: number;
}): number {
	const pipeline = options.pipelineLatencySec ?? DEFAULT_PIPELINE_LATENCY_SEC;
	const { nowMs, sampleTimestampSec, receivedAtMs } = options;
	const nowSec = nowMs / 1000;
	const receivedSec =
		receivedAtMs != null && Number.isFinite(receivedAtMs)
			? receivedAtMs / 1000
			: nowSec;

	if (sampleTimestampSec != null) {
		const dataAgeAtReceipt = Math.max(0, receivedSec - sampleTimestampSec);
		const sinceReceipt = Math.max(0, nowSec - receivedSec);
		const age =
			dataAgeAtReceipt + sinceReceipt + TIMESTAMP_PIPELINE_BUFFER_SEC;
		return Math.max(0, Math.min(MAX_EXTRAPOLATION_AGE_SEC, age));
	}

	const sinceReceipt = Math.max(0, nowSec - receivedSec);
	const age = sinceReceipt + pipeline;
	return Math.max(0, Math.min(MAX_EXTRAPOLATION_AGE_SEC, age));
}

export function normalizeSpeedMps(speed: number | null | undefined): number {
	if (speed == null || !Number.isFinite(speed) || speed < MIN_MOVING_SPEED_MPS) {
		return 0;
	}
	return Math.min(MAX_SPEED_MPS, speed);
}

export function inferSpeedMpsFromPositionDelta(options: {
	prevLat: number;
	prevLng: number;
	prevReceivedAtMs: number;
	lat: number;
	lng: number;
	nowMs: number;
}): number {
	const dtSec = (options.nowMs - options.prevReceivedAtMs) / 1000;
	if (dtSec < 1 || !Number.isFinite(dtSec)) return 0;

	const distM = getDistanceFromLatLon(
		options.prevLat,
		options.prevLng,
		options.lat,
		options.lng,
	);
	if (distM < 8) return 0;

	return Math.min(MAX_SPEED_MPS, distM / dtSec);
}

export function resolveEffectiveSpeedMps(
	reportedSpeedMps: number | null | undefined,
	inferredSpeedMps: number,
): number {
	const reported = normalizeSpeedMps(reportedSpeedMps);
	if (reported > 0) return reported;
	if (inferredSpeedMps >= MIN_MOVING_SPEED_MPS) return inferredSpeedMps;
	return 0;
}

export function estimateVehiclePositionOnShape(options: {
	samplePosition: { lat: number; lng: number };
	shapePoints: IShapes[];
	speedMps: number | null | undefined;
	inferredSpeedMps?: number;
	sampleTimestampSec: number | null;
	nowMs: number;
	receivedAtMs?: number | null;
	hintIndex?: number;
	pipelineLatencySec?: number;
}): {
	lat: number;
	lng: number;
	index: number;
	t: number;
	speedMps: number;
	ageSec: number;
	extrapolatedDistanceM: number;
	projectedLat: number;
	projectedLng: number;
} {
	const speed = resolveEffectiveSpeedMps(
		options.speedMps,
		options.inferredSpeedMps ?? 0,
	);
	const ageSec = computeSampleAgeSec({
		nowMs: options.nowMs,
		sampleTimestampSec: options.sampleTimestampSec,
		receivedAtMs: options.receivedAtMs ?? null,
		pipelineLatencySec: options.pipelineLatencySec,
	});

	const hint = options.hintIndex ?? 0;
	const projection = projectRtToShape(
		options.samplePosition,
		options.shapePoints,
		Math.max(0, hint - 80),
		400,
		hint,
	);

	const extrapolatedDistanceM = Math.min(
		MAX_EXTRAPOLATION_DISTANCE_M,
		speed * ageSec,
	);
	const advanced =
		extrapolatedDistanceM > 0
			? advanceAlongShapePoints(
					options.shapePoints,
					projection.index,
					projection.t,
					extrapolatedDistanceM,
				)
			: {
					lat: projection.lat,
					lng: projection.lng,
					index: projection.index,
					t: projection.t,
				};

	return {
		...advanced,
		speedMps: speed,
		ageSec,
		extrapolatedDistanceM,
		projectedLat: projection.lat,
		projectedLng: projection.lng,
	};
}
