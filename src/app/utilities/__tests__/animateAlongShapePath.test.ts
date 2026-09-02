import type { IShapes } from "@shared/models/IShapes";
import { describe, expect, it } from "vitest";
import {
	buildShapePathPoints,
	computeReconcileDurationSec,
	computeShapePathLengthM,
} from "../animateAlongShapePath";
import {
	inferSpeedMpsFromPositionDelta,
	resolveEffectiveSpeedMps,
} from "../estimateVehiclePositionNow";

function makeShape(points: Array<{ lat: number; lng: number }>): IShapes[] {
	return points.map((point, index) => ({
		shape_id: "test",
		shape_pt_lat: point.lat,
		shape_pt_lon: point.lng,
		shape_pt_sequence: index,
	}));
}

describe("inferSpeedMpsFromPositionDelta", () => {
	it("infers speed when feed reports zero but GPS moved (metro)", () => {
		const speed = inferSpeedMpsFromPositionDelta({
			prevLat: 59.0,
			prevLng: 18.0,
			prevReceivedAtMs: 1_000_000,
			lat: 59.005,
			lng: 18.0,
			nowMs: 1_045_000,
		});
		expect(speed).toBeGreaterThan(5);
	});

	it("returns 0 when position barely changed", () => {
		const speed = inferSpeedMpsFromPositionDelta({
			prevLat: 59.0,
			prevLng: 18.0,
			prevReceivedAtMs: 1_000_000,
			lat: 59.00001,
			lng: 18.0,
			nowMs: 1_010_000,
		});
		expect(speed).toBe(0);
	});
});

describe("resolveEffectiveSpeedMps", () => {
	it("uses inferred speed when reported speed is zero", () => {
		expect(resolveEffectiveSpeedMps(0, 12)).toBe(12);
	});

	it("prefers reported speed when available", () => {
		expect(resolveEffectiveSpeedMps(8, 12)).toBe(8);
	});
});

describe("shape path animation helpers", () => {
	const shape = makeShape([
		{ lat: 59.0, lng: 18.0 },
		{ lat: 59.001, lng: 18.0 },
		{ lat: 59.002, lng: 18.0 },
		{ lat: 59.003, lng: 18.0 },
	]);

	it("builds a path with intermediate vertices", () => {
		const path = buildShapePathPoints(
			shape,
			{ lat: 59.0, lng: 18.0 },
			0,
			{ lat: 59.003, lng: 18.0 },
			2,
		);
		expect(path.length).toBeGreaterThan(3);
		expect(computeShapePathLengthM(path)).toBeGreaterThan(200);
	});

	it("caps long station-to-station animation duration", () => {
		const duration = computeReconcileDurationSec(900, 14);
		expect(duration).toBeLessThanOrEqual(8);
		expect(duration).toBeGreaterThanOrEqual(2.5);
	});

	it("uses shorter catch-up duration when marker is behind", () => {
		const normal = computeReconcileDurationSec(120, 10);
		const catchUp = computeReconcileDurationSec(120, 10, { catchUp: true });
		expect(catchUp).toBeLessThan(normal);
		expect(catchUp).toBeGreaterThanOrEqual(1);
		expect(catchUp).toBeLessThanOrEqual(4.5);
	});

	it("builds backward path when estimate index is behind marker", () => {
		const path = buildShapePathPoints(
			shape,
			{ lat: 59.002, lng: 18.0 },
			2,
			{ lat: 59.001, lng: 18.0 },
			1,
		);
		expect(path.length).toBeGreaterThan(2);
		expect(computeShapePathLengthM(path)).toBeGreaterThan(50);
	});
});
