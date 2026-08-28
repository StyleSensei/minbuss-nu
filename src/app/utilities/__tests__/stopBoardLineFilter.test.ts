import type { IDbData } from "@shared/models/IDbData";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import { describe, expect, it } from "vitest";
import {
	filterStopBoardByLines,
	filterStopBoardShapes,
	toggleStopBoardLine,
} from "../stopBoardLineFilter";

const departure = (
	tripId: string,
	line: string,
	stopId = "stop-1",
	routeType = 700,
): IDbData => ({
	operator: "sl",
	trip_id: tripId,
	shape_id: "",
	route_short_name: line,
	route_type: routeType,
	stop_headsign: "Centrum",
	stop_id: stopId,
	departure_time: "12:00:00",
	stop_name: "Testhållplats",
	stop_sequence: 1,
	stop_lat: 59,
	stop_lon: 18,
	feed_version: "test",
});

const vehicle = (tripId: string, vehicleId: string): IVehiclePosition => ({
	trip: {
		tripId,
		scheduleRelationship: null,
	},
	position: {
		latitude: 59,
		longitude: 18,
		bearing: null,
		speed: null,
	},
	timestamp: null,
	vehicle: { id: vehicleId },
});

describe("filterStopBoardByLines", () => {
	const departures = [
		departure("trip-1", "1"),
		departure("trip-2", "2"),
		departure("trip-3", "3"),
	];
	const vehicles = [
		vehicle("trip-1", "vehicle-1"),
		vehicle("trip-2", "vehicle-2"),
		vehicle("trip-2", "vehicle-2"),
		vehicle("other-trip", "vehicle-4"),
	];

	it("returns all board departures and matching unique vehicles in Alla mode", () => {
		const result = filterStopBoardByLines(departures, vehicles, null);

		expect(result.departures).toHaveLength(3);
		expect([...result.tripIds]).toEqual(["trip-1", "trip-2", "trip-3"]);
		expect(result.vehicles.map((item) => item.vehicle.id)).toEqual([
			"vehicle-1",
			"vehicle-2",
		]);
	});

	it("filters departures, trip ids and vehicles by multiple lines", () => {
		const result = filterStopBoardByLines(departures, vehicles, ["1", "3"]);

		expect(result.departures.map((item) => item.route_short_name)).toEqual([
			"1",
			"3",
		]);
		expect([...result.tripIds]).toEqual(["trip-1", "trip-3"]);
		expect(result.vehicles.map((item) => item.vehicle.id)).toEqual([
			"vehicle-1",
		]);
	});

	it("returns an empty board for unknown selected lines", () => {
		const result = filterStopBoardByLines(departures, vehicles, ["X"]);

		expect(result.departures).toEqual([]);
		expect(result.tripIds.size).toBe(0);
		expect(result.vehicles).toEqual([]);
	});

	it("combines exact platform, route type and line filters", () => {
		const mixedDepartures = [
			departure("bus-a", "19", "platform-a", 700),
			departure("subway-a", "19", "platform-a", 401),
			departure("bus-b", "19", "platform-b", 700),
			departure("bus-c", "17", "platform-a", 700),
		];
		const mixedVehicles = mixedDepartures.map((item) =>
			vehicle(item.trip_id, `vehicle-${item.trip_id}`),
		);

		const result = filterStopBoardByLines(
			mixedDepartures,
			mixedVehicles,
			["19"],
			"platform-a",
			700,
		);

		expect(result.departures.map((item) => item.trip_id)).toEqual(["bus-a"]);
		expect(result.vehicles.map((item) => item.vehicle.id)).toEqual([
			"vehicle-bus-a",
		]);
	});
});

describe("toggleStopBoardLine", () => {
	const routes = ["1", "2", "3"];

	it("moves from Alla to one line and replaces the previous selection", () => {
		expect(toggleStopBoardLine(null, "1", routes)).toEqual(["1"]);
		expect(toggleStopBoardLine(["1"], "3", routes)).toEqual(["3"]);
	});

	it("returns to Alla when the final selected line is removed", () => {
		expect(toggleStopBoardLine(["2"], "2", routes)).toBeNull();
	});

	it("replaces legacy multiple selections with the clicked line", () => {
		expect(toggleStopBoardLine(["1", "2"], "3", routes)).toEqual(["3"]);
	});

	it("ignores unavailable lines", () => {
		expect(toggleStopBoardLine(["1"], "X", routes)).toEqual(["1"]);
	});
});

describe("filterStopBoardShapes", () => {
	const point = {
		shape_id: "shape-1",
		shape_pt_lat: 59,
		shape_pt_lon: 18,
		shape_pt_sequence: 1,
	};
	const shapes = [
		{
			route_short_name: "1",
			route_type: 700,
			shape_id: "shape-1",
			points: [point],
		},
		{
			route_short_name: "1",
			route_type: 700,
			shape_id: "shape-2",
			points: [point],
		},
		{
			route_short_name: "2",
			route_type: 401,
			shape_id: "shape-3",
			points: [point],
		},
		{
			route_short_name: "2",
			route_type: 401,
			shape_id: "shape-1",
			points: [point],
		},
	];

	it("returns all unique variants in Alla mode", () => {
		expect(
			filterStopBoardShapes(shapes, null).map((shape) => shape.shape_id),
		).toEqual(["shape-1", "shape-2", "shape-3"]);
	});

	it("returns every variant for multiple selected lines", () => {
		expect(
			filterStopBoardShapes(shapes, ["1", "2"]).map((shape) => shape.shape_id),
		).toEqual(["shape-1", "shape-2", "shape-3"]);
	});

	it("returns no shapes for an unknown line", () => {
		expect(filterStopBoardShapes(shapes, ["X"])).toEqual([]);
	});

	it("filters shapes by route type", () => {
		expect(
			filterStopBoardShapes(shapes, null, 401).map((shape) => shape.shape_id),
		).toEqual(["shape-3", "shape-1"]);
	});

	it("keeps refs with empty points so route colors can appear before geometry", () => {
		const refsOnly = [
			{
				route_short_name: "17",
				route_type: 401,
				shape_id: "metro-17",
				points: [],
			},
			{
				route_short_name: "177",
				route_type: 700,
				shape_id: "bus-177",
				points: [],
			},
		];

		expect(
			filterStopBoardShapes(refsOnly, ["17", "177"]).map(
				(shape) => shape.shape_id,
			),
		).toEqual(["metro-17", "bus-177"]);
	});
});
