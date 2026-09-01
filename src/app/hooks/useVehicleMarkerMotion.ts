"use client";

import type { IShapes } from "@/shared/models/IShapes";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { advanceAlongShapePoints } from "../utilities/advanceAlongShape";
import {
	estimateVehiclePositionOnShape,
	parseVehicleTimestampSec,
} from "../utilities/estimateVehiclePositionNow";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { projectRtToShape } from "../utilities/projectPointOnSegment";

const MAX_STEP_M_PER_FRAME = 2.5;
const MAX_PROJ_DIST2 = 7e-4;
const THROTTLE_SKIP_WRITES = 3;
/** Gaps below this are ignored — marker is close enough to estimated reality. */
const SNAP_IGNORE_GAP_M = 2;
/** Smooth only tiny gaps; larger gaps snap immediately (passenger parity). */
const SMOOTH_RECONCILE_MAX_GAP_M = 12;
const SMOOTH_RECONCILE_SEC = 0.35;

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

/**
 * Passenger-parity marker motion: extrapolate from each RT sample using speed and age,
 * then cruise along the shape at reported speed between polls.
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
	const hintIndexRef = useRef(0);
	const receivedAtMsRef = useRef<number | null>(null);
	const reconcileRafRef = useRef(0);
	const throttleRef = useRef(0);
	const prevShapeMetaRef = useRef<{ shapeId: string | null; shapeLen: number } | null>(
		null,
	);
	const shapePointsRef = useRef(shapePoints);
	shapePointsRef.current = shapePoints;

	const applyMotionState = (
		targetMarker: google.maps.marker.AdvancedMarkerElement,
		state: MotionState,
	) => {
		motionRef.current = state;
		hintIndexRef.current = state.index;
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
		estimate: MotionState,
		current: { lat: number; lng: number } | null,
	) => {
		if (reconcileRafRef.current) {
			cancelAnimationFrame(reconcileRafRef.current);
			reconcileRafRef.current = 0;
		}

		const gapM = current
			? getDistanceFromLatLon(current.lat, current.lng, estimate.lat, estimate.lng)
			: Number.POSITIVE_INFINITY;

		if (!current || gapM <= SNAP_IGNORE_GAP_M) {
			applyMotionState(targetMarker, estimate);
			return;
		}

		if (gapM > SMOOTH_RECONCILE_MAX_GAP_M) {
			applyMotionState(targetMarker, estimate);
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

	// Re-anchor on each RT sample.
	useEffect(() => {
		const points = shapePointsRef.current;
		if (!marker || points.length < 2) return;

		const nowMs = Date.now();
		receivedAtMsRef.current = nowMs;

		const shapeMeta = {
			shapeId: points[0]?.shape_id ?? null,
			shapeLen: points.length,
		};
		const prevShape = prevShapeMetaRef.current;
		const shapeChanged =
			!prevShape ||
			prevShape.shapeId !== shapeMeta.shapeId ||
			prevShape.shapeLen !== shapeMeta.shapeLen;
		prevShapeMetaRef.current = shapeMeta;

		if (
			initialLastIndexRef?.current != null &&
			hintIndexRef.current === 0 &&
			!motionRef.current
		) {
			hintIndexRef.current = initialLastIndexRef.current;
		}

		const hint = motionRef.current?.index ?? hintIndexRef.current;
		const sampleTimestampSec = parseVehicleTimestampSec(vehicleTimestamp);

		if (shapeChanged) {
			const resetProjection = projectRtToShape(vehiclePosition, points, 0, 400, hint);
			const RESET_MAX_DIST2 = 8e-4;
			if (resetProjection.dist2 < RESET_MAX_DIST2) {
				const estimate = estimateVehiclePositionOnShape({
					samplePosition: vehiclePosition,
					shapePoints: points,
					speedMps,
					sampleTimestampSec,
					nowMs,
					hintIndex: resetProjection.index,
				});
				applyMotionState(marker, {
					lat: estimate.lat,
					lng: estimate.lng,
					index: estimate.index,
					t: estimate.t,
					speedMps: estimate.speedMps,
				});
			} else {
				applyMotionState(marker, {
					lat: vehiclePosition.lat,
					lng: vehiclePosition.lng,
					index: 0,
					t: 0,
					speedMps: 0,
				});
			}
			return;
		}

		const estimate = estimateVehiclePositionOnShape({
			samplePosition: vehiclePosition,
			shapePoints: points,
			speedMps,
			sampleTimestampSec,
			nowMs,
			receivedAtMs: receivedAtMsRef.current,
			hintIndex: hint,
		});

		const estimateState: MotionState = {
			lat: estimate.lat,
			lng: estimate.lng,
			index: estimate.index,
			t: estimate.t,
			speedMps: estimate.speedMps,
		};

		reconcileToEstimate(marker, estimateState, readMarkerLatLng(marker.position));

		return () => {
			if (reconcileRafRef.current) {
				cancelAnimationFrame(reconcileRafRef.current);
				reconcileRafRef.current = 0;
			}
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

	// Cruise at passenger speed between RT samples.
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
			if (reconcileRafRef.current) return;

			const motion = motionRef.current;
			if (!motion || motion.speedMps <= 0) return;

			const points = shapePointsRef.current;
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
