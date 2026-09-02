import type { IShapes } from "@shared/models/IShapes";
import { describe, expect, it } from "vitest";
import {
	computeSampleAgeSec,
	DEFAULT_PIPELINE_LATENCY_SEC,
	estimateVehiclePositionOnShape,
	inferSpeedMpsFromPositionDelta,
	normalizeSpeedMps,
	parseVehicleTimestampSec,
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
	it("caps age even when vehicle timestamp is much older than receipt", () => {
		const receivedAtMs = 1_700_000_000_000;
		const nowMs = receivedAtMs + 3_000;
		const age = computeSampleAgeSec({
			nowMs,
			sampleTimestampSec: 1_699_999_970,
			receivedAtMs,
		});
		expect(age).toBeLessThanOrEqual(8);
		expect(age).toBeGreaterThan(0);
	});

	it("does not grow unbounded from an old timestamp on later polls", () => {
		const receivedAtMs = 1_700_000_000_000;
		const nowMs = receivedAtMs + 5_000;
		const age = computeSampleAgeSec({
			nowMs,
			sampleTimestampSec: 1_699_999_000,
			receivedAtMs,
		});
		expect(age).toBeLessThan(20);
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
		const receivedAtMs = 1_700_000_000_000;
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.0, lng: 18.0 },
			shapePoints: shape,
			speedMps,
			sampleTimestampSec: 1_700_000_000,
			nowMs: receivedAtMs + 5_000,
			receivedAtMs,
			pipelineLatencySec: 0,
		});

		expect(result.extrapolatedDistanceM).toBeGreaterThan(0);
		expect(result.lat).toBeGreaterThan(59.0);
	});

	it("caps extrapolation distance", () => {
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.0, lng: 18.0 },
			shapePoints: shape,
			speedMps: 20,
			sampleTimestampSec: 1_700_000_000,
			nowMs: 1_700_000_030_000,
			receivedAtMs: 1_700_000_030_000,
			pipelineLatencySec: 0,
		});

		expect(result.extrapolatedDistanceM).toBeLessThanOrEqual(72);
	});

	it("uses inferred speed when reported speed is missing", () => {
		const receivedAtMs = 1_700_000_000_000;
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.005, lng: 18.0 },
			shapePoints: shape,
			speedMps: 0,
			inferredSpeedMps: 12,
			sampleTimestampSec: 1_700_000_000,
			nowMs: receivedAtMs + 5_000,
			receivedAtMs,
			pipelineLatencySec: 0,
		});

		expect(result.speedMps).toBe(12);
		expect(result.extrapolatedDistanceM).toBeGreaterThan(0);
	});

	it("stays at sample when speed is zero", () => {
		const result = estimateVehiclePositionOnShape({
			samplePosition: { lat: 59.001, lng: 18.0 },
			shapePoints: shape,
			speedMps: 0,
			sampleTimestampSec: 1_700_000_000,
			nowMs: 1_700_000_010_000,
			receivedAtMs: 1_700_000_010_000,
			pipelineLatencySec: 0,
		});

		expect(result.extrapolatedDistanceM).toBe(0);
		expect(result.lat).toBeCloseTo(59.001, 4);
	});
});
