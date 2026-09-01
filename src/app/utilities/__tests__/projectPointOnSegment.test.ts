import type { IShapes } from "@shared/models/IShapes";
import { describe, expect, it } from "vitest";
import { projectRtToShape } from "../projectPointOnSegment";

function makeShape(
	points: Array<{ lat: number; lng: number }>,
): IShapes[] {
	return points.map((point, index) => ({
		shape_id: "test-shape",
		shape_pt_lat: point.lat,
		shape_pt_lon: point.lng,
		shape_pt_sequence: index,
	}));
}

describe("projectRtToShape", () => {
	it("projects onto the closest segment when no hint is provided", () => {
		const shape = makeShape([
			{ lat: 59.0, lng: 18.0 },
			{ lat: 59.001, lng: 18.0 },
			{ lat: 59.002, lng: 18.0 },
		]);

		const projection = projectRtToShape(
			{ lat: 59.0015, lng: 18.0 },
			shape,
			0,
			10,
		);

		expect(projection.index).toBe(1);
		expect(projection.t).toBeCloseTo(0.5, 3);
	});

	it("prefers the segment near hintIndex when distances tie on overlapping geometry", () => {
		const shape = makeShape([
			{ lat: 59.0, lng: 18.0 },
			{ lat: 59.004, lng: 18.0 },
			{ lat: 59.004, lng: 18.0001 },
			{ lat: 59.0, lng: 18.0001 },
		]);

		const rt = { lat: 59.002, lng: 18.00005 };
		const nearFirstLeg = projectRtToShape(rt, shape, 0, 10, 0);
		const nearReturnLeg = projectRtToShape(rt, shape, 0, 10, 2);

		expect(nearFirstLeg.index).toBe(0);
		expect(nearReturnLeg.index).toBe(2);
		expect(nearFirstLeg.dist2).toBeCloseTo(nearReturnLeg.dist2, 8);
	});
});
