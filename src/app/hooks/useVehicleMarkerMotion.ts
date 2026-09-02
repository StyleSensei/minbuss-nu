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
	MAX_CRUISE_DRIFT_FROM_GPS_M,
	parseVehicleTimestampSec,
} from "../utilities/estimateVehiclePositionNow";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { projectRtToShape } from "../utilities/projectPointOnSegment";

const MAX_STEP_M_PER_FRAME = 2.2;
const MAX_PROJ_DIST2 = 7e-4;
const THROTTLE_SKIP_WRITES = 3;
const SNAP_IGNORE_GAP_M = 2;
/** Below this gap we lerp directly; above we follow the route shape. */
const SHAPE_ANIMATION_MIN_GAP_M = 18;
const SMOOTH_RECONCILE_SEC = 0.35;
const MAX_CRUISE_DRIFT_M = 120;

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

function allowedCruiseDriftM(sample: SampleRefState, nowMs: number): number {
	const sinceSampleSec = Math.max(0, (nowMs - sample.receivedAtMs) / 1000);
	return Math.min(
		MAX_CRUISE_DRIFT_M,
		MAX_CRUISE_DRIFT_FROM_GPS_M + sample.speedMps * sinceSampleSec * 1.15,
	);
}

/**
 * Passenger-parity marker motion: extrapolate once per RT sample, then cruise at
 * reported (or inferred) speed with a ceiling relative to the latest GPS fix.
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

	const isAnimating = () =>
		reconcileRafRef.current !== 0 || pathAnimCancelRef.current != null;

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

	const reconcileToEstimate = (
		targetMarker: google.maps.marker.AdvancedMarkerElement,
		points: IShapes[],
		estimate: MotionState,
		current: { lat: number; lng: number } | null,
		fromIndex: number,
	) => {
		cancelReconcileAnimation();
		cancelPathAnimation();

		const gapM = current
			? getDistanceFromLatLon(current.lat, current.lng, estimate.lat, estimate.lng)
			: Number.POSITIVE_INFINITY;

		if (!current || gapM <= SNAP_IGNORE_GAP_M) {
			applyMotionState(targetMarker, estimate);
			return;
		}

		if (gapM >= SHAPE_ANIMATION_MIN_GAP_M) {
			const pathPoints = buildShapePathPoints(
				points,
				current,
				fromIndex,
				{ lat: estimate.lat, lng: estimate.lng },
				estimate.index,
			);
			const pathLengthM = computeShapePathLengthM(pathPoints);
			const durationSec = computeReconcileDurationSec(
				pathLengthM,
				estimate.speedMps,
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
					applyMotionState(targetMarker, estimate);
				},
			});
			return;
		}

		const from = { ...current };
		const startMs = performance.now();
		const tick = (nowMs: number) => {
			const t = Math.min(1, (nowMs - startMs) / (SMOOTH_RECONCILE_SEC * 1000));
			const lat = from.lat + (estimate.lat - from.lat) * t;
			const lng = from.lng + (estimate.lng - from.lng) * t;
			if (t >= 1) {
				reconcileRafRef.current = 0;
				applyMotionState(targetMarker, estimate);
				return;
			}
			writeMarkerPosition(
				targetMarker,
				lat,
				lng,
				skipWritesRef,
				throttleRef,
				onPositionWriteRef,
			);
			reconcileRafRef.current = requestAnimationFrame(tick);
		};
		reconcileRafRef.current = requestAnimationFrame(tick);
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
		const currentProj = current
			? projectRtToShape(current, points, Math.max(0, hint - 80), 300, hint)
			: null;
		const fromIndex = currentProj?.index ?? hint;

		const markerAheadOfEstimate =
			current &&
			getDistanceFromLatLon(current.lat, current.lng, estimate.lat, estimate.lng) >
				SHAPE_ANIMATION_MIN_GAP_M &&
			getDistanceFromLatLon(
				current.lat,
				current.lng,
				estimate.projectedLat,
				estimate.projectedLng,
			) >
				getDistanceFromLatLon(
					estimate.lat,
					estimate.lng,
					estimate.projectedLat,
					estimate.projectedLng,
				);

		if (markerAheadOfEstimate) {
			cancelPathAnimation();
			cancelReconcileAnimation();
			applyMotionState(marker, estimateState);
			return;
		}

		reconcileToEstimate(marker, points, estimateState, current, fromIndex);

		return () => {
			cancelReconcileAnimation();
			cancelPathAnimation();
		};
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
			if (isAnimating()) return;

			const motion = motionRef.current;
			const sample = sampleRef.current;
			if (!motion || !sample || motion.speedMps <= 0) return;

			const points = shapePointsRef.current;
			const gpsProj = projectRtToShape(
				{ lat: sample.lat, lng: sample.lng },
				points,
				Math.max(0, sample.hintIndex - 80),
				400,
				sample.hintIndex,
			);

			const driftCap = allowedCruiseDriftM(sample, Date.now());
			const driftFromGps = getDistanceFromLatLon(
				motion.lat,
				motion.lng,
				gpsProj.lat,
				gpsProj.lng,
			);
			if (driftFromGps >= driftCap) return;

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

			let stepM = motion.speedMps * dtSec;
			stepM = Math.min(stepM, MAX_STEP_M_PER_FRAME);
			if (stepM < 0.02) return;

			const next = advanceAlongShapePoints(points, proj.index, proj.t, stepM);
			const nextDrift = getDistanceFromLatLon(
				next.lat,
				next.lng,
				gpsProj.lat,
				gpsProj.lng,
			);
			if (nextDrift > driftCap) return;

			applyMotionState(marker, {
				lat: next.lat,
				lng: next.lng,
				index: next.index,
				t: next.t,
				speedMps: motion.speedMps,
			});
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [marker, shapePoints, skipWritesRef, onPositionWriteRef]);
}
