import type { IShapes } from "@shared/models/IShapes";
import { describe, expect, it } from "vitest";
import {
	computeSampleAgeSec,
	DEFAULT_PIPELINE_LATENCY_SEC,
	estimateVehiclePositionOnShape,
	normalizeSpeedMps,
	parseVehicleTimestampSec,
} from "../estimateVehiclePositionNow";

function makeShape(points: Array<{ lat: number; lng: number }>): IShapes[] {
	return points.map((point, index) => ({
		shape_id: "test",
		shape_pt_lat: point.lat,
		shape_pt_lon: point.lng,
		shape_pt_sequence: index,
	}));
}

describe("parseVehicleTimestampSec", () => {
	it("parses unix seconds", () => {
		expect(parseVehicleTimestampSec("1700000000")).toBe(1700000000);
	});

	it("converts millisecond timestamps", () => {
		expect(parseVehicleTimestampSec("1700000000000")).toBe(1700000000);
	});
});

describe("normalizeSpeedMps", () => {
	it("returns 0 for stationary bus", () => {
		expect(normalizeSpeedMps(0)).toBe(0);
		expect(normalizeSpeedMps(0.1)).toBe(0);
	});

	it("clamps high speeds", () => {
		expect(normalizeSpeedMps(40)).toBeLessThanOrEqual(28);
	});
});

describe("computeSampleAgeSec", () => {
	it("adds pipeline latency to vehicle timestamp age", () => {
		const nowMs = 1_700_000_005_000;
		const age = computeSampleAgeSec({
			nowMs,
			sampleTimestampSec: 1_700_000_000,
			receivedAtMs: null,
			pipelineLatencySec: 2,
		});
		expect(age).toBeCloseTo(7, 5);
	});

	it("falls back to receivedAt when timestamp is missing", () => {
		const nowMs = 1_000_000;
		const age = computeSampleAgeSec({
			nowMs,
			sampleTimestampSec: null,
			receivedAtMs: 995_000,
			pipelineLatencySec: DEFAULT_PIPELINE_LATENCY_SEC,
		});
		expect(age).toBeCloseTo(7.5, 5);
	});
});

describe("estimateVehiclePositionOnShape", () => {
	const shape = makeShape([
		{ lat: 59.0, lng: 18.0 },
		{ lat: 59.001, lng: 18.0 },
		{ lat: 59.002, lng: 18.0 },
	]);

	it("extrapolates forward when bus has been moving", () => {
		const speedMps = 20 / 3.6;
		const ageSec = 5;
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.0, lng: 18.0 },
			shapePoints: shape,
			speedMps,
			sampleTimestampSec: 1_700_000_000,
			nowMs: (1_700_000_000 + ageSec) * 1000,
			pipelineLatencySec: 0,
		});

		expect(result.extrapolatedDistanceM).toBeCloseTo(speedMps * ageSec, 0);
		expect(result.lat).toBeGreaterThan(59.0);
	});

	it("stays at sample when speed is zero", () => {
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.001, lng: 18.0 },
			shapePoints: shape,
			speedMps: 0,
			sampleTimestampSec: 1_700_000_000,
			nowMs: 1_700_000_010_000,
			pipelineLatencySec: 0,
		});

		expect(result.extrapolatedDistanceM).toBe(0);
		expect(result.lat).toBeCloseTo(59.001, 4);
	});
});
