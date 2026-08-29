import { describe, expect, it } from "vitest";
import { getCompassHeadingFromEvent } from "../deviceCompassHeading";

describe("getCompassHeadingFromEvent", () => {
	it("uses webkitCompassHeading on iOS", () => {
		const event = {
			alpha: null,
			absolute: false,
			webkitCompassHeading: 123,
		} as DeviceOrientationEvent;

		expect(getCompassHeadingFromEvent(event)).toBe(123);
	});

	it("uses alpha when absolute orientation is available", () => {
		const event = {
			alpha: 45,
			absolute: true,
		} as DeviceOrientationEvent;

		expect(getCompassHeadingFromEvent(event)).toBe(45);
	});

	it("falls back to inverted alpha on relative orientation", () => {
		const event = {
			alpha: 90,
			absolute: false,
		} as DeviceOrientationEvent;

		expect(getCompassHeadingFromEvent(event)).toBe(270);
	});
});
