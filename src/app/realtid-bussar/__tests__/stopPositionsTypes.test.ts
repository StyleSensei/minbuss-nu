import type { IStopBoardChild } from "@shared/models/IStopBoardStation";
import { describe, expect, it } from "vitest";
import {
	buildFocusedStationMarkers,
	filterStopsInViewport,
	type IStopPositionJson,
} from "../stopPositionsTypes";

const stationId = "station";
const busParentId = "bus-parent";
const subwayParentId = "subway-parent";

const stops: IStopPositionJson[] = [
	{
		id: stationId,
		name: "Brommaplan",
		lat: 59.338,
		lon: 17.939,
		isParent: true,
		locationType: 1,
	},
	{
		id: "bus-a",
		name: "Brommaplan",
		lat: 59.3381,
		lon: 17.9391,
		isParent: false,
		locationType: 0,
		platformCode: "A",
		parent: stationId,
	},
	{
		id: "subway-entrance",
		name: "Brommaplan",
		lat: 59.3382,
		lon: 17.9392,
		isParent: false,
		locationType: 2,
		parent: stationId,
	},
	{
		id: "bus-b",
		name: "Brommaplan",
		lat: 59.34,
		lon: 17.95,
		isParent: false,
		locationType: 0,
		platformCode: "B",
		parent: stationId,
	},
];

const bounds: google.maps.LatLngBoundsLiteral = {
	north: 59.339,
	south: 59.337,
	east: 17.94,
	west: 17.938,
};

const child = (
	id: string,
	locationType: number,
	parent: string,
	platformCode: string | null,
	lat: number,
	lon: number,
): IStopBoardChild => ({
	stop_id: id,
	stop_name: "Brommaplan",
	location_type: locationType,
	parent_station: parent,
	platform_code: platformCode,
	stop_lat: lat,
	stop_lon: lon,
});

describe("filterStopsInViewport station presentation", () => {
	it("shows a subway entrance instead of its platforms without a focused station", () => {
		expect(
			filterStopsInViewport(stops, 18, bounds).map((stop) => ({
				id: stop.id,
				presentation: stop.presentation,
			})),
		).toEqual([{ id: "subway-entrance", presentation: "group-stop" }]);
	});

	it("collapses nearby same-name bus and subway stops before CurrentTrips is opened", () => {
		const idleStops: IStopPositionJson[] = [
			{
				id: busParentId,
				name: "Brommaplan",
				lat: 59.3382,
				lon: 17.9382,
				isParent: true,
				locationType: 1,
			},
			{
				id: "bus-a",
				name: "Brommaplan",
				lat: 59.3381,
				lon: 17.9381,
				isParent: false,
				locationType: 0,
				platformCode: "A",
				parent: busParentId,
			},
			{
				id: "bus-old",
				name: "Brommaplan",
				lat: 59.33815,
				lon: 17.93815,
				isParent: false,
				locationType: 0,
				platformCode: "OLD2",
				parent: busParentId,
			},
			{
				id: subwayParentId,
				name: "Brommaplan",
				lat: 59.338284,
				lon: 17.939641,
				isParent: true,
				locationType: 1,
			},
			{
				id: "subway-1",
				name: "Brommaplan",
				lat: 59.338284,
				lon: 17.939641,
				isParent: false,
				locationType: 0,
				platformCode: "1",
				parent: subwayParentId,
			},
			{
				id: "subway-entrance",
				name: "Brommaplan",
				lat: 59.3383,
				lon: 17.9395,
				isParent: false,
				locationType: 2,
				parent: subwayParentId,
			},
		];

		expect(
			filterStopsInViewport(idleStops, 18, bounds).map((stop) => ({
				id: stop.id,
				presentation: stop.presentation,
				platformCode: stop.platformCode,
			})),
		).toEqual([
			{
				id: busParentId,
				presentation: "group-stop",
				platformCode: undefined,
			},
			{
				id: "bus-a",
				presentation: "platform-label",
				platformCode: "A",
			},
			{
				id: "subway-entrance",
				presentation: "group-stop",
				platformCode: undefined,
			},
		]);
	});

	it("keeps children visible when the stop name has no platform codes", () => {
		const unnamed: IStopPositionJson[] = [
			{
				id: "parent",
				name: "Sandviksvägen",
				lat: 59.3382,
				lon: 17.9385,
				isParent: true,
				locationType: 1,
			},
			{
				id: "child-1",
				name: "Sandviksvägen",
				lat: 59.3381,
				lon: 17.9384,
				isParent: false,
				locationType: 0,
				parent: "parent",
			},
			{
				id: "child-2",
				name: "Sandviksvägen",
				lat: 59.3383,
				lon: 17.9386,
				isParent: false,
				locationType: 0,
				parent: "parent",
			},
		];

		expect(
			filterStopsInViewport(unnamed, 18, bounds)
				.map((stop) => stop.id)
				.sort(),
		).toEqual(["child-1", "child-2"]);
	});

	it("does not add the parent marker when a station without platform codes is selected", () => {
		const unnamed: IStopPositionJson[] = [
			{
				id: "parent",
				name: "Sandviksvägen",
				lat: 59.3382,
				lon: 17.9385,
				isParent: true,
				locationType: 1,
			},
			{
				id: "child-1",
				name: "Sandviksvägen",
				lat: 59.3381,
				lon: 17.9384,
				isParent: false,
				locationType: 0,
				parent: "parent",
			},
			{
				id: "child-2",
				name: "Sandviksvägen",
				lat: 59.3383,
				lon: 17.9386,
				isParent: false,
				locationType: 0,
				parent: "parent",
			},
		];

		expect(
			filterStopsInViewport(unnamed, 18, bounds, ["parent"])
				.map((stop) => stop.id)
				.sort(),
		).toEqual(["child-1", "child-2"]);
	});

	it("hides original children when grouped presentation markers exist", () => {
		const grouped: IStopPositionJson[] = [
			...stops,
			{
				id: busParentId,
				name: "Brommaplan",
				lat: 59.33815,
				lon: 17.93915,
				isParent: true,
				locationType: 1,
				presentation: "group-stop",
			},
			{
				id: "bus-a",
				name: "Brommaplan",
				lat: 59.3381,
				lon: 17.9391,
				isParent: false,
				locationType: 0,
				platformCode: "A",
				parent: busParentId,
				presentation: "platform-label",
			},
			{
				id: "subway-entrance",
				name: "Brommaplan",
				lat: 59.3382,
				lon: 17.9392,
				isParent: false,
				locationType: 2,
				parent: subwayParentId,
				presentation: "group-stop",
			},
		];

		expect(
			filterStopsInViewport(grouped, 18, bounds, [
				busParentId,
				subwayParentId,
			]).map((stop) => `${stop.id}:${stop.presentation ?? "raw"}`),
		).toEqual([
			`${busParentId}:group-stop`,
			"bus-a:platform-label",
			"subway-entrance:group-stop",
		]);
	});
});

describe("buildFocusedStationMarkers", () => {
	const children: IStopBoardChild[] = [
		child("bus-a", 0, busParentId, "A", 59.3381, 17.9374),
		child("bus-old", 0, busParentId, "OLD2", 59.3382, 17.9375),
		child("bus-none", 0, busParentId, null, 59.3383, 17.9376),
		child("subway-1", 0, subwayParentId, "1", 59.338284, 17.939641),
		child("subway-2", 0, subwayParentId, "2", 59.338284, 17.939641),
		child("subway-entrance", 2, subwayParentId, null, 59.3384, 17.939),
	];
	const departures = [
		{ stop_id: "bus-a", route_type: 700 },
		{ stop_id: "bus-old", route_type: 700 },
		{ stop_id: "bus-none", route_type: 700 },
		{ stop_id: "subway-1", route_type: 401 },
		{ stop_id: "subway-2", route_type: 401 },
	];

	it("keeps one clickable bus stop, one subway entrance and short bus platform labels", () => {
		const markers = buildFocusedStationMarkers(
			children,
			departures,
			"Brommaplan",
		);

		expect(
			markers.map((marker) => ({
				id: marker.id,
				presentation: marker.presentation,
				locationType: marker.locationType,
				platformCode: marker.platformCode,
			})),
		).toEqual([
			{
				id: busParentId,
				presentation: "group-stop",
				locationType: 1,
				platformCode: undefined,
			},
			{
				id: "bus-a",
				presentation: "platform-label",
				locationType: 0,
				platformCode: "A",
			},
			{
				id: "subway-entrance",
				presentation: "group-stop",
				locationType: 2,
				platformCode: undefined,
			},
		]);
	});

	it("does not collapse a station that has no displayable platform codes", () => {
		expect(
			buildFocusedStationMarkers(
				[
					child("child-1", 0, "parent", null, 59.3381, 17.9384),
					child("child-2", 0, "parent", null, 59.3383, 17.9386),
				],
				[
					{ stop_id: "child-1", route_type: 700 },
					{ stop_id: "child-2", route_type: 700 },
				],
				"Sandviksvägen",
			),
		).toEqual([]);
	});
});
