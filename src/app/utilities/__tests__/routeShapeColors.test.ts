import { describe, expect, it } from "vitest";
import { createRouteShapeColorMap, colorForRoute } from "../routeShapeColors";

describe("createRouteShapeColorMap", () => {
	it("assigns one stable color per unique route", () => {
		const colors = createRouteShapeColorMap(["177", "340", "177"]);

		expect(colors.size).toBe(2);
		expect(colors.get("177")).toBeDefined();
		expect(colors.get("177")).not.toBe(colors.get("340"));
	});

	it("keeps colors stable regardless of input order", () => {
		const first = createRouteShapeColorMap(["14", "13"]);
		const second = createRouteShapeColorMap(["13", "14"]);

		expect(first.get("13")).toBe(second.get("13"));
		expect(first.get("14")).toBe(second.get("14"));
	});
});

describe("colorForRoute", () => {
	it("returns the mapped color for a route short name", () => {
		const colors = createRouteShapeColorMap(["4", "177"]);

		expect(colorForRoute(colors, "4")).toBe(colors.get("4"));
		expect(colorForRoute(colors, " 177 ")).toBe(colors.get("177"));
	});

	it("returns undefined without a color map or unknown route", () => {
		const colors = createRouteShapeColorMap(["4"]);

		expect(colorForRoute(undefined, "4")).toBeUndefined();
		expect(colorForRoute(colors, "177")).toBeUndefined();
		expect(colorForRoute(colors, "")).toBeUndefined();
	});
});
