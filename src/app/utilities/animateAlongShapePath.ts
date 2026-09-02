import type { IShapes } from "@/shared/models/IShapes";
import { getDistanceFromLatLon } from "./getDistanceFromLatLon";
import { MAX_SPEED_MPS } from "./estimateVehiclePositionNow";

/** Minimum speed used when computing animation duration for large shape gaps. */
const MIN_ANIMATION_SPEED_MPS = 6;
const MIN_ANIMATION_SEC = 2.5;
const MAX_ANIMATION_SEC = 8;

export function buildShapePathPoints(
	shapePoints: IShapes[],
	from: { lat: number; lng: number },
	fromIndex: number,
	to: { lat: number; lng: number },
	toIndex: number,
): Array<{ lat: number; lng: number }> {
	const points: Array<{ lat: number; lng: number }> = [{ ...from }];
	const start = Math.min(fromIndex, toIndex);
	const end = Math.max(fromIndex, toIndex);
	for (let i = Math.min(start + 1, shapePoints.length - 1); i <= end; i++) {
		const p = shapePoints[i];
		points.push({ lat: p.shape_pt_lat, lng: p.shape_pt_lon });
	}
	points.push({ ...to });
	return points;
}

export function computeShapePathLengthM(
	points: Array<{ lat: number; lng: number }>,
): number {
	let total = 0;
	for (let i = 0; i < points.length - 1; i++) {
		total += getDistanceFromLatLon(
			points[i].lat,
			points[i].lng,
			points[i + 1].lat,
			points[i + 1].lng,
		);
	}
	return total;
}

export function computeReconcileDurationSec(
	pathLengthM: number,
	speedMps: number,
): number {
	const speed = Math.max(
		MIN_ANIMATION_SPEED_MPS,
		Math.min(MAX_SPEED_MPS, speedMps),
	);
	return Math.max(
		MIN_ANIMATION_SEC,
		Math.min(MAX_ANIMATION_SEC, pathLengthM / speed),
	);
}

export function interpolateShapePathAtDistance(
	points: Array<{ lat: number; lng: number }>,
	segLens: number[],
	distanceM: number,
): { lat: number; lng: number } {
	if (points.length === 0) return { lat: 0, lng: 0 };
	if (points.length === 1 || distanceM <= 0) return { ...points[0] };

	let remaining = distanceM;
	for (let i = 0; i < segLens.length; i++) {
		if (remaining <= segLens[i]) {
			const a = points[i];
			const b = points[i + 1];
			const denom = segLens[i] || 1;
			const t = remaining / denom;
			return {
				lat: a.lat + (b.lat - a.lat) * t,
				lng: a.lng + (b.lng - a.lng) * t,
			};
		}
		remaining -= segLens[i];
	}

	return { ...points[points.length - 1] };
}

export function startAnimateAlongShapePath(options: {
	shapePoints: IShapes[];
	from: { lat: number; lng: number };
	fromIndex: number;
	to: { lat: number; lng: number };
	toIndex: number;
	durationSec: number;
	onFrame: (lat: number, lng: number) => void;
	onComplete: () => void;
}): () => void {
	const pathPoints = buildShapePathPoints(
		options.shapePoints,
		options.from,
		options.fromIndex,
		options.to,
		options.toIndex,
	);
	const segLens: number[] = [];
	let total = 0;
	for (let i = 0; i < pathPoints.length - 1; i++) {
		const len = getDistanceFromLatLon(
			pathPoints[i].lat,
			pathPoints[i].lng,
			pathPoints[i + 1].lat,
			pathPoints[i + 1].lng,
		);
		segLens.push(len);
		total += len;
	}

	if (total <= 0.5) {
		options.onFrame(options.to.lat, options.to.lng);
		options.onComplete();
		return () => {};
	}

	const startMs = performance.now();
	let raf = 0;

	const tick = (nowMs: number) => {
		const t = Math.min(1, (nowMs - startMs) / (options.durationSec * 1000));
		const pos = interpolateShapePathAtDistance(pathPoints, segLens, total * t);
		options.onFrame(pos.lat, pos.lng);
		if (t >= 1) {
			raf = 0;
			options.onComplete();
			return;
		}
		raf = requestAnimationFrame(tick);
	};

	raf = requestAnimationFrame(tick);
	return () => {
		if (raf) cancelAnimationFrame(raf);
	};
}
