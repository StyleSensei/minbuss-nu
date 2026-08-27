import { describe, expect, it } from "vitest";
import type { IStopBoardShape } from "@shared/models/IStopBoardShape";
import {
	compactLineShapes,
	compactStopBoardShapes,
	downsampleShapePoints,
	expandLineShapes,
	expandStopBoardShapes,
} from "../compactStopBoardShapes";

describe("downsampleShapePoints", () => {
	it("keeps short polylines unchanged", () => {
		expect(downsampleShapePoints([1, 2, 3], 10)).toEqual([1, 2, 3]);
	});

	it("always keeps the first and last point", () => {
		const points = Array.from({ length: 1000 }, (_, index) => index);
		const downsampled = downsampleShapePoints(points, 8);

		expect(downsampled[0]).toBe(0);
		expect(downsampled.at(-1)).toBe(999);
		expect(downsampled.length).toBeLessThanOrEqual(8);
	});
});

describe("compactStopBoardShapes", () => {
	const shape: IStopBoardShape = {
		route_short_name: "177",
		route_type: 700,
		shape_id: "shape-1",
		points: Array.from({ length: 500 }, (_, index) => ({
			shape_id: "shape-1",
			shape_pt_lat: 59 + index / 10000,
			shape_pt_lon: 18 + index / 10000,
			shape_pt_sequence: index,
			shape_dist_traveled: index,
		})),
	};

	it("stores rounded lat/lng pairs without extra GTFS fields", () => {
		const compact = compactStopBoardShapes([shape], 10);

		expect(compact).toHaveLength(1);
		expect(compact[0].points.length).toBeLessThanOrEqual(10);
		expect(compact[0].points[0]).toEqual([
			Number(shape.points[0].shape_pt_lat.toFixed(5)),
			Number(shape.points[0].shape_pt_lon.toFixed(5)),
		]);
		expect(JSON.stringify(compact).includes("shape_dist_traveled")).toBe(false);
	});

	it("round-trips compact shapes back to map-ready points", () => {
		const expanded = expandStopBoardShapes(compactStopBoardShapes([shape], 12));

		expect(expanded[0].shape_id).toBe("shape-1");
		expect(expanded[0].points[0].shape_pt_lat).toBeDefined();
		expect(expanded[0].points.at(-1)?.shape_pt_lon).toBeDefined();
	});

	it("reduces Redis JSON far below the raw GTFS point payload", () => {
		const rawBytes = Buffer.byteLength(JSON.stringify([shape]));
		const compactBytes = Buffer.byteLength(
			JSON.stringify(compactStopBoardShapes([shape], 240)),
		);

		expect(compactBytes).toBeLessThan(rawBytes / 5);
	});
});

describe("compactLineShapes", () => {
	it("round-trips downsampled points for map polylines", () => {
		const points = Array.from({ length: 400 }, (_, index) => ({
			shape_id: "line-shape",
			shape_pt_lat: 59 + index / 10000,
			shape_pt_lon: 18 + index / 10000,
			shape_pt_sequence: index,
		}));
		const expanded = expandLineShapes(
			compactLineShapes([{ shape_id: "line-shape", points }], 12),
		);

		expect(expanded[0].shape_id).toBe("line-shape");
		expect(expanded[0].points.length).toBeLessThanOrEqual(12);
		expect(expanded[0].points[0].shape_pt_lat).toBeDefined();
	});
});
