import { describe, expect, it } from "vitest";
import { createRouteShapeColorMap } from "../routeShapeColors";
import {
	mergeStreamedStopBoardShape,
	parseStopBoardShapeStreamEvent,
	stopBoardShapesFromRefs,
} from "../stopBoardShapeStream";

describe("stopBoardShapesFromRefs", () => {
	it("creates shapes without points so colors can land before polylines", () => {
		const shapes = stopBoardShapesFromRefs([
			{
				route_short_name: "17",
				route_type: 401,
				shape_id: "metro",
			},
			{
				route_short_name: "177",
				route_type: 700,
				shape_id: "bus",
			},
		]);

		expect(shapes.map((shape) => shape.points)).toEqual([[], []]);
		const colors = createRouteShapeColorMap(
			shapes.map((shape) => shape.route_short_name),
		);
		expect(colors.get("17")).toBeDefined();
		expect(colors.get("177")).toBeDefined();
	});
});

describe("mergeStreamedStopBoardShape", () => {
	it("replaces the matching ref with compact geometry", () => {
		const refs = stopBoardShapesFromRefs([
			{ route_short_name: "177", route_type: 700, shape_id: "bus" },
		]);
		const merged = mergeStreamedStopBoardShape(refs, {
			route_short_name: "177",
			route_type: 700,
			shape_id: "bus",
			points: [
				[59.33, 18.06],
				[59.34, 18.07],
			],
		});

		expect(merged).toHaveLength(1);
		expect(merged[0].points).toEqual([
			{
				shape_id: "bus",
				shape_pt_lat: 59.33,
				shape_pt_lon: 18.06,
				shape_pt_sequence: 0,
			},
			{
				shape_id: "bus",
				shape_pt_lat: 59.34,
				shape_pt_lon: 18.07,
				shape_pt_sequence: 1,
			},
		]);
	});
});

describe("parseStopBoardShapeStreamEvent", () => {
	it("parses refs, shape and done lines", () => {
		expect(
			parseStopBoardShapeStreamEvent(
				'{"type":"refs","refs":[{"route_short_name":"17","route_type":401,"shape_id":"m"}]}',
			),
		).toEqual({
			type: "refs",
			refs: [{ route_short_name: "17", route_type: 401, shape_id: "m" }],
		});
		expect(parseStopBoardShapeStreamEvent('{"type":"done"}')).toEqual({
			type: "done",
		});
		expect(parseStopBoardShapeStreamEvent("")).toBeNull();
	});
});
