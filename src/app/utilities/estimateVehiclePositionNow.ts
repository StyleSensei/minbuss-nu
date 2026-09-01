import type { IShapes } from "@/shared/models/IShapes";
import { advanceAlongShapePoints } from "./advanceAlongShape";
import { projectRtToShape } from "./projectPointOnSegment";

/** Extra latency on top of vehicle timestamp (Redis TTL + poll interval, ~half each). */
export const DEFAULT_PIPELINE_LATENCY_SEC = 2.5;
export const MAX_EXTRAPOLATION_AGE_SEC = 30;
export const MIN_MOVING_SPEED_MPS = 0.3;
export const MAX_SPEED_MPS = 28;

export function parseVehicleTimestampSec(
	timestamp: string | null | undefined,
): number | null {
	if (timestamp == null || timestamp === "") return null;
	const n = Number(timestamp);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n > 1e12 ? n / 1000 : n;
}

export function computeSampleAgeSec(options: {
	nowMs: number;
	sampleTimestampSec: number | null;
	receivedAtMs: number | null;
	pipelineLatencySec?: number;
}): number {
	const pipeline = options.pipelineLatencySec ?? DEFAULT_PIPELINE_LATENCY_SEC;
	const { nowMs, sampleTimestampSec, receivedAtMs } = options;

	if (sampleTimestampSec != null) {
		const age = nowMs / 1000 - sampleTimestampSec + pipeline;
		return Math.max(0, Math.min(MAX_EXTRAPOLATION_AGE_SEC, age));
	}

	if (receivedAtMs != null) {
		const age = (nowMs - receivedAtMs) / 1000 + pipeline;
		return Math.max(0, Math.min(MAX_EXTRAPOLATION_AGE_SEC, age));
	}

	return Math.min(MAX_EXTRAPOLATION_AGE_SEC, pipeline);
}

export function normalizeSpeedMps(speed: number | null | undefined): number {
	if (speed == null || !Number.isFinite(speed) || speed < MIN_MOVING_SPEED_MPS) {
		return 0;
	}
	return Math.min(MAX_SPEED_MPS, speed);
}

export function estimateVehiclePositionOnShape(options: {
	samplePosition: { lat: number; lng: number };
	shapePoints: IShapes[];
	speedMps: number | null | undefined;
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
} {
	const speed = normalizeSpeedMps(options.speedMps);
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

	const extrapolatedDistanceM = speed * ageSec;
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
	};
}
