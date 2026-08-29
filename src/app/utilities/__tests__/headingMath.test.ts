import { describe, expect, it } from "vitest";
import { getBearingFromLatLon } from "../getBearingFromLatLon";
import { shortestAngleDelta, smoothHeading } from "../headingMath";

describe("getBearingFromLatLon", () => {
	it("returns ~0° when moving north", () => {
		expect(getBearingFromLatLon(59.33, 18.06, 59.34, 18.06)).toBeCloseTo(0, 0);
	});

	it("returns ~90° when moving east", () => {
		expect(getBearingFromLatLon(59.33, 18.06, 59.33, 18.07)).toBeCloseTo(90, 0);
	});
});

describe("shortestAngleDelta", () => {
	it("returns the shortest signed difference across 0°", () => {
		expect(shortestAngleDelta(350, 10)).toBeCloseTo(20, 5);
		expect(shortestAngleDelta(10, 350)).toBeCloseTo(-20, 5);
	});
});

describe("smoothHeading", () => {
	it("returns the next heading when there is no previous value", () => {
		expect(smoothHeading(null, 45)).toBe(45);
	});

	it("ignores tiny jitter below epsilon", () => {
		expect(smoothHeading(90, 92, 0.35, 5)).toBe(90);
	});
});
