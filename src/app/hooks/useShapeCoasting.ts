"use client";

import type { IShapes } from "@/shared/models/IShapes";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import { advanceAlongShapePoints } from "../utilities/advanceAlongShape";
import { getDistanceFromLatLon } from "../utilities/getDistanceFromLatLon";
import { projectRtToShape } from "../utilities/projectPointOnSegment";

const COAST_GRACE_MS = 220;
const COAST_MAX_AGE_MS = 14_000;
const COAST_MAX_DT_SEC = 0.08;
const DEFAULT_SPEED_MPS = 9;
const MAX_SPEED_MPS = 28;
const THROTTLE_SKIP_WRITES = 3;
/** I samma enheter som `projectRtToShape` dist2 — ungefär motsvarar ~80–120 m lateral avvikelse. */
const MAX_PROJ_DIST2 = 7e-4;
const MAX_ANCHOR_TO_PROJ_M = 85;
const MAX_DRIFT_FROM_REPORTED_VEHICLE_M = 175;
const MAX_STEP_M_PER_FRAME = 2.2;
/** Max antal segment att söka från start (prestanda); täcker de flesta linjers shape. */
const PROJ_SEARCH_MAX_SEGMENTS = 2500;

function readMarkerLatLng(
	pos: google.maps.LatLng | google.maps.LatLngLiteral | string | null | undefined,
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

interface UseShapeCoastingParams {
	marker: google.maps.marker.AdvancedMarkerElement | null;
	shapePoints: IShapes[];
	vehicleLat: number;
	vehicleLng: number;
	/** GTFS-RT VehiclePosition.speed — meters per second, or null. */
	speedMps: number | null;
	timelineBusyRef: MutableRefObject<boolean>;
	skipWritesRef?: MutableRefObject<boolean>;
	onPositionWriteRef?: MutableRefObject<
		((lat: number, lng: number) => void) | null
	>;
}

/**
 * Between realtime samples, advances the marker forward along the route shape using speed
 * (from feed or inferred from successive positions) so motion does not fully stop during polling gaps.
 */
export function useShapeCoasting({
	marker,
	shapePoints,
	vehicleLat,
	vehicleLng,
	speedMps,
	timelineBusyRef,
	skipWritesRef,
	onPositionWriteRef,
}: UseShapeCoastingParams) {
	const lastRtWallMsRef = useRef(0);
	const coastHintIndexRef = useRef(0);
	const speedEstimateRef = useRef(DEFAULT_SPEED_MPS);
	const prevSampleRef = useRef<{
		lat: number;
		lng: number;
		t: number;
	} | null>(null);
	const throttleCoastRef = useRef(0);

	useEffect(() => {
		if (shapePoints.length < 2) return;
		lastRtWallMsRef.current = Date.now();
		const proj = projectRtToShape(
			{ lat: vehicleLat, lng: vehicleLng },
			shapePoints,
			0,
			400,
		);
		coastHintIndexRef.current = proj.index;

		const prev = prevSampleRef.current;
		const now = performance.now();
		if (prev) {
			const dtSec = Math.max(0.25, (now - prev.t) / 1000);
			const distM = getDistanceFromLatLon(
				prev.lat,
				prev.lng,
				vehicleLat,
				vehicleLng,
			);
			const inst = distM / dtSec;
			if (Number.isFinite(inst) && inst > 0.5) {
				speedEstimateRef.current =
					speedEstimateRef.current * 0.65 + Math.min(inst, MAX_SPEED_MPS) * 0.35;
			}
		}
		prevSampleRef.current = { lat: vehicleLat, lng: vehicleLng, t: now };
	}, [vehicleLat, vehicleLng, shapePoints]);

	useEffect(() => {
		if (!marker || shapePoints.length < 2) return;

		let raf = 0;
		let lastFrameMs = performance.now();

		const tick = () => {
			raf = requestAnimationFrame(tick);
			const nowMs = performance.now();
			const dtSec = Math.min(
				COAST_MAX_DT_SEC,
				Math.max(0, (nowMs - lastFrameMs) / 1000),
			);
			lastFrameMs = nowMs;

			if (timelineBusyRef.current) return;
			if (typeof document !== "undefined" && document.hidden) return;

			const sinceRt = Date.now() - lastRtWallMsRef.current;
			if (sinceRt < COAST_GRACE_MS) return;
			if (sinceRt > COAST_MAX_AGE_MS) return;

			const anchor = readMarkerLatLng(marker.position);
			if (!anchor) return;

			// Sök från början av shapen med tillräckligt brett fönster — annars väljs fel gren på långa rutter.
			const maxSeg = Math.max(0, shapePoints.length - 2);
			const searchWindow = Math.min(maxSeg, PROJ_SEARCH_MAX_SEGMENTS);
			const proj = projectRtToShape(anchor, shapePoints, 0, searchWindow);

			if (proj.dist2 > MAX_PROJ_DIST2) return;

			const anchorToProjM = getDistanceFromLatLon(
				anchor.lat,
				anchor.lng,
				proj.lat,
				proj.lng,
			);
			if (anchorToProjM > MAX_ANCHOR_TO_PROJ_M) return;

			const speed =
				speedMps != null && Number.isFinite(speedMps) && speedMps > 0.3
					? Math.min(MAX_SPEED_MPS, speedMps)
					: Math.min(MAX_SPEED_MPS, speedEstimateRef.current);
			let stepM = Math.max(0, speed) * dtSec;
			stepM = Math.min(stepM, MAX_STEP_M_PER_FRAME);
			if (stepM < 0.02) return;

			const next = advanceAlongShapePoints(
				shapePoints,
				proj.index,
				proj.t,
				stepM,
			);

			const driftFromReported = getDistanceFromLatLon(
				next.lat,
				next.lng,
				vehicleLat,
				vehicleLng,
			);
			if (driftFromReported > MAX_DRIFT_FROM_REPORTED_VEHICLE_M) return;

			const leapFromAnchor = getDistanceFromLatLon(
				anchor.lat,
				anchor.lng,
				next.lat,
				next.lng,
			);
			if (leapFromAnchor > 22) return;

			coastHintIndexRef.current = next.index;

			if (skipWritesRef?.current) {
				throttleCoastRef.current += 1;
				if (throttleCoastRef.current % THROTTLE_SKIP_WRITES !== 0) return;
			} else {
				throttleCoastRef.current = 0;
			}

			marker.position = new google.maps.LatLng(next.lat, next.lng);
			onPositionWriteRef?.current?.(next.lat, next.lng);
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [marker, shapePoints, speedMps, timelineBusyRef, skipWritesRef, onPositionWriteRef]);
}
