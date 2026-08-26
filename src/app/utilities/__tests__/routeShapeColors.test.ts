import { describe, expect, it } from "vitest";
import { createRouteShapeColorMap } from "../routeShapeColors";

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
