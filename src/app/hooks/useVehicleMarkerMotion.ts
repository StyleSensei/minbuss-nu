"use client";

import type { IShapes } from "@/shared/models/IShapes";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import {
	buildShapePathPoints,
	computeReconcileDurationSec,
	computeShapePathLengthM,
	startAnimateAlongShapePath,
} from "../utilities/animateAlongShapePath";
import { advanceAlongShapePoints } from "../utilities/advanceAlongShape";
import {
	estimateVehiclePositionOnShape,
	inferSpeedMpsFromPositionDelta,
	parseVehicleTimestampSec,
} from "../utilities/estimateVehiclePositionNow";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { projectRtToShape } from "../utilities/projectPointOnSegment";

const MAX_STEP_M_PER_FRAME = 2.4;
const MAX_CATCH_UP_STEP_M_PER_FRAME = 7;
const MAX_PROJ_DIST2 = 7e-4;
const THROTTLE_SKIP_WRITES = 3;
const SNAP_IGNORE_GAP_M = 2;
const CATCH_UP_CLOSE_SEC = 0.75;
/** Large route discontinuities (e.g. metro between stations) use shape animation. */
const SHAPE_ANIMATION_MIN_GAP_M = 45;
const MAX_AHEAD_OF_LIVE_M = 18;

function readMarkerLatLng(
	pos:
		| google.maps.LatLng
		| google.maps.LatLngLiteral
		| string
		| null
		| undefined,
): { lat: number; lng: number } | null {
	if (!pos) return null;
	const p = pos as { lat?: unknown; lng?: unknown };
	const lat =
		typeof p.lat === "function" ? (p.lat as () => number)() : Number(p.lat);
	const lng =
		typeof p.lng === "function" ? (p.lng as () => number)() : Number(p.lng);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return { lat, lng };
}

interface MotionState {
	lat: number;
	lng: number;
	index: number;
	t: number;
	speedMps: number;
}

interface SampleRefState {
	lat: number;
	lng: number;
	speedMps: number;
	receivedAtMs: number;
	hintIndex: number;
	timestampSec: number | null;
}

interface UseVehicleMarkerMotionParams {
	marker: google.maps.marker.AdvancedMarkerElement | null;
	shapePoints: IShapes[];
	vehiclePosition: { lat: number; lng: number };
	speedMps: number | null;
	vehicleTimestamp: string | null;
	initialLastIndexRef?: RefObject<number | null>;
	skipWritesRef?: RefObject<boolean>;
	onPositionWriteRef?: RefObject<((lat: number, lng: number) => void) | null>;
}

function writeMarkerPosition(
	marker: google.maps.marker.AdvancedMarkerElement,
	lat: number,
	lng: number,
	skipWritesRef: RefObject<boolean> | undefined,
	throttleRef: { current: number },
	onPositionWriteRef?: RefObject<((lat: number, lng: number) => void) | null>,
) {
	if (skipWritesRef?.current) {
		throttleRef.current += 1;
		if (throttleRef.current % THROTTLE_SKIP_WRITES !== 0) return;
	} else {
		throttleRef.current = 0;
	}
	marker.position = new google.maps.LatLng(lat, lng);
	onPositionWriteRef?.current?.(lat, lng);
}

function shapeProgress(index: number, t: number): number {
	return index + t;
}

function isBehindOnShape(
	motion: { index: number; t: number },
	target: { index: number; t: number },
): boolean {
	return (
		shapeProgress(motion.index, motion.t) <
		shapeProgress(target.index, target.t) - 0.0005
	);
}

function computeLiveEstimate(
	points: IShapes[],
	sample: SampleRefState,
	hintIndex: number,
	nowMs: number,
): MotionState {
	const estimate = estimateVehiclePositionOnShape({
		samplePosition: { lat: sample.lat, lng: sample.lng },
		shapePoints: points,
		speedMps: sample.speedMps,
		sampleTimestampSec: sample.timestampSec,
		nowMs,
		receivedAtMs: sample.receivedAtMs,
		hintIndex,
	});
	return {
		lat: estimate.lat,
		lng: estimate.lng,
		index: estimate.index,
		t: estimate.t,
		speedMps: estimate.speedMps,
	};
}

/**
 * Passenger-parity marker motion: live extrapolation every frame, with faster
 * catch-up when the marker falls behind the moving target.
 */
export function useVehicleMarkerMotion({
	marker,
	shapePoints,
	vehiclePosition,
	speedMps,
	vehicleTimestamp,
	initialLastIndexRef,
	skipWritesRef,
	onPositionWriteRef,
}: UseVehicleMarkerMotionParams) {
	const motionRef = useRef<MotionState | null>(null);
	const sampleRef = useRef<SampleRefState | null>(null);
	const reconcileRafRef = useRef(0);
	const pathAnimCancelRef = useRef<(() => void) | null>(null);
	const throttleRef = useRef(0);
	const prevShapeIdRef = useRef<string | null>(null);
	const shapePointsRef = useRef(shapePoints);
	shapePointsRef.current = shapePoints;

	const cancelPathAnimation = () => {
		pathAnimCancelRef.current?.();
		pathAnimCancelRef.current = null;
	};

	const cancelReconcileAnimation = () => {
		if (reconcileRafRef.current) {
			cancelAnimationFrame(reconcileRafRef.current);
			reconcileRafRef.current = 0;
		}
	};

	const isPathAnimating = () => pathAnimCancelRef.current != null;

	const applyMotionState = (
		targetMarker: google.maps.marker.AdvancedMarkerElement,
		state: MotionState,
	) => {
		motionRef.current = state;
		writeMarkerPosition(
			targetMarker,
			state.lat,
			state.lng,
			skipWritesRef,
			throttleRef,
			onPositionWriteRef,
		);
	};

	const animateAlongShapeToEstimate = (
		targetMarker: google.maps.marker.AdvancedMarkerElement,
		points: IShapes[],
		estimate: MotionState,
		current: { lat: number; lng: number },
		fromIndex: number,
		pathLengthM: number,
		catchUp: boolean,
	) => {
		cancelReconcileAnimation();
		cancelPathAnimation();

		const durationSec = computeReconcileDurationSec(
			pathLengthM,
			Math.max(estimate.speedMps, 8),
			{ catchUp },
		);

		pathAnimCancelRef.current = startAnimateAlongShapePath({
			shapePoints: points,
			from: current,
			fromIndex,
			to: { lat: estimate.lat, lng: estimate.lng },
			toIndex: estimate.index,
			durationSec,
			onFrame: (lat, lng) => {
				writeMarkerPosition(
					targetMarker,
					lat,
					lng,
					skipWritesRef,
					throttleRef,
					onPositionWriteRef,
				);
			},
			onComplete: () => {
				pathAnimCancelRef.current = null;
				const sample = sampleRef.current;
				if (!sample) {
					applyMotionState(targetMarker, estimate);
					return;
				}
				applyMotionState(
					targetMarker,
					computeLiveEstimate(
						points,
						sample,
						estimate.index,
						Date.now(),
					),
				);
			},
		});
	};

	useEffect(() => {
		const points = shapePointsRef.current;
		if (!marker || points.length < 2) return;

		const nowMs = Date.now();
		const shapeId = points[0]?.shape_id ?? null;
		const shapeChanged = prevShapeIdRef.current !== shapeId;
		prevShapeIdRef.current = shapeId;

		if (
			initialLastIndexRef?.current != null &&
			!motionRef.current &&
			!sampleRef.current
		) {
			sampleRef.current = {
				lat: vehiclePosition.lat,
				lng: vehiclePosition.lng,
				speedMps: speedMps ?? 0,
				receivedAtMs: nowMs,
				hintIndex: initialLastIndexRef.current,
				timestampSec: parseVehicleTimestampSec(vehicleTimestamp),
			};
		}

		const prevSample = sampleRef.current;
		const inferredSpeedMps = prevSample
			? inferSpeedMpsFromPositionDelta({
					prevLat: prevSample.lat,
					prevLng: prevSample.lng,
					prevReceivedAtMs: prevSample.receivedAtMs,
					lat: vehiclePosition.lat,
					lng: vehiclePosition.lng,
					nowMs,
				})
			: 0;

		const hint =
			motionRef.current?.index ??
			prevSample?.hintIndex ??
			initialLastIndexRef?.current ??
			0;
		const sampleTimestampSec = parseVehicleTimestampSec(vehicleTimestamp);

		const estimate = estimateVehiclePositionOnShape({
			samplePosition: vehiclePosition,
			shapePoints: points,
			speedMps,
			inferredSpeedMps,
			sampleTimestampSec,
			nowMs,
			receivedAtMs: nowMs,
			hintIndex: hint,
		});

		sampleRef.current = {
			lat: vehiclePosition.lat,
			lng: vehiclePosition.lng,
			speedMps: estimate.speedMps,
			receivedAtMs: nowMs,
			hintIndex: estimate.index,
			timestampSec: sampleTimestampSec,
		};

		const estimateState: MotionState = {
			lat: estimate.lat,
			lng: estimate.lng,
			index: estimate.index,
			t: estimate.t,
			speedMps: estimate.speedMps,
		};

		if (shapeChanged || !motionRef.current) {
			cancelPathAnimation();
			cancelReconcileAnimation();
			applyMotionState(marker, estimateState);
			return;
		}

		const current = readMarkerLatLng(marker.position);
		if (!current) {
			applyMotionState(marker, estimateState);
			return;
		}

		const fromIndex =
			motionRef.current?.index ??
			projectRtToShape(current, points, Math.max(0, hint - 80), 300, hint)
				.index;

		const gapM = getDistanceFromLatLon(
			current.lat,
			current.lng,
			estimate.lat,
			estimate.lng,
		);
		const indexJump = Math.abs(estimate.index - fromIndex);
		const needsShapeAnimation =
			gapM >= SHAPE_ANIMATION_MIN_GAP_M &&
			(estimate.index < fromIndex || indexJump >= 2);

		if (!needsShapeAnimation) {
			cancelPathAnimation();
			return;
		}

		const pathPoints = buildShapePathPoints(
			points,
			current,
			fromIndex,
			{ lat: estimate.lat, lng: estimate.lng },
			estimate.index,
		);
		const pathLengthM = Math.max(gapM, computeShapePathLengthM(pathPoints));
		const catchUp = estimate.index >= fromIndex;

		animateAlongShapeToEstimate(
			marker,
			points,
			estimateState,
			current,
			fromIndex,
			pathLengthM,
			catchUp,
		);
	}, [
		marker,
		vehiclePosition.lat,
		vehiclePosition.lng,
		speedMps,
		vehicleTimestamp,
		initialLastIndexRef,
		skipWritesRef,
		onPositionWriteRef,
	]);

	useEffect(() => {
		if (!marker || shapePoints.length < 2) return;

		let raf = 0;
		let lastFrameMs = performance.now();

		const tick = () => {
			raf = requestAnimationFrame(tick);
			const nowMs = performance.now();
			const dtSec = Math.min(0.1, Math.max(0, (nowMs - lastFrameMs) / 1000));
			lastFrameMs = nowMs;

			if (typeof document !== "undefined" && document.hidden) return;
			if (isPathAnimating()) return;

			const motion = motionRef.current;
			const sample = sampleRef.current;
			if (!motion || !sample) return;

			const points = shapePointsRef.current;
			const live = computeLiveEstimate(
				points,
				sample,
				motion.index,
				Date.now(),
			);

			if (live.speedMps <= 0) {
				const gapM = getDistanceFromLatLon(
					motion.lat,
					motion.lng,
					live.lat,
					live.lng,
				);
				if (gapM <= SNAP_IGNORE_GAP_M) return;
			}

			const gapM = getDistanceFromLatLon(
				motion.lat,
				motion.lng,
				live.lat,
				live.lng,
			);

			if (gapM <= SNAP_IGNORE_GAP_M) {
				applyMotionState(marker, live);
				return;
			}

			const behind = isBehindOnShape(motion, live);
			if (!behind && gapM > MAX_AHEAD_OF_LIVE_M) return;

			const maxSeg = Math.max(0, points.length - 2);
			const hint = Math.max(0, Math.min(maxSeg, motion.index - 40));
			const proj = projectRtToShape(
				{ lat: motion.lat, lng: motion.lng },
				points,
				hint,
				180,
				motion.index,
			);
			if (proj.dist2 > MAX_PROJ_DIST2) return;

			let stepM = live.speedMps * dtSec;
			if (behind) {
				stepM = Math.max(
					stepM,
					gapM * (dtSec / CATCH_UP_CLOSE_SEC),
				);
			}
			stepM = Math.min(
				stepM,
				gapM,
				behind ? MAX_CATCH_UP_STEP_M_PER_FRAME : MAX_STEP_M_PER_FRAME,
			);
			if (stepM < 0.02) return;

			const next = advanceAlongShapePoints(points, proj.index, proj.t, stepM);

			applyMotionState(marker, {
				lat: next.lat,
				lng: next.lng,
				index: next.index,
				t: next.t,
				speedMps: live.speedMps,
			});
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [marker, shapePoints, skipWritesRef, onPositionWriteRef]);
}
