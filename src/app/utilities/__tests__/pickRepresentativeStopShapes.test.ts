import { describe, expect, it } from "vitest";
import {
	pickRepresentativeStopBoardShapeRefs,
	stopBoardShapeRouteKey,
} from "../pickRepresentativeStopShapes";

describe("stopBoardShapeRouteKey", () => {
	it("keeps directions of the same line apart", () => {
		expect(
			stopBoardShapeRouteKey({
				route_short_name: "177",
				route_type: 700,
				shape_id: "a",
				direction_id: 0,
			}),
		).not.toBe(
			stopBoardShapeRouteKey({
				route_short_name: "177",
				route_type: 700,
				shape_id: "b",
				direction_id: 1,
			}),
		);
	});
});

describe("pickRepresentativeStopBoardShapeRefs", () => {
	it("keeps the longest shape when a shorter variant comes last", () => {
		const picked = pickRepresentativeStopBoardShapeRefs(
			[
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "full-morby",
					direction_id: 0,
				},
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "short-solna",
					direction_id: 0,
				},
			],
			new Map([
				["full-morby", 1800],
				["short-solna", 1100],
			]),
		);

		expect(picked.map((shape) => shape.shape_id)).toEqual(["full-morby"]);
	});

	it("keeps the longest shape in each direction", () => {
		const picked = pickRepresentativeStopBoardShapeRefs(
			[
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "to-skärvik-short",
					direction_id: 0,
				},
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "to-skärvik-full",
					direction_id: 0,
				},
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "to-mörby-full",
					direction_id: 1,
				},
				{
					route_short_name: "177",
					route_type: 700,
					shape_id: "to-mörby-short",
					direction_id: 1,
				},
			],
			new Map([
				["to-skärvik-short", 900],
				["to-skärvik-full", 1800],
				["to-mörby-full", 1750],
				["to-mörby-short", 800],
			]),
		);

		expect(picked.map((shape) => shape.shape_id).sort()).toEqual([
			"to-mörby-full",
			"to-skärvik-full",
		]);
	});

	it("keeps separate route types with the same short name", () => {
		const picked = pickRepresentativeStopBoardShapeRefs(
			[
				{
					route_short_name: "1",
					route_type: 700,
					shape_id: "bus",
					direction_id: 0,
				},
				{
					route_short_name: "1",
					route_type: 401,
					shape_id: "metro",
					direction_id: 0,
				},
			],
			new Map([
				["bus", 100],
				["metro", 50],
			]),
		);

		expect(picked.map((shape) => shape.shape_id).sort()).toEqual([
			"bus",
			"metro",
		]);
	});
});
