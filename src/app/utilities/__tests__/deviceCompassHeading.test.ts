import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getCompassHeadingFromEvent,
	needsDeviceOrientationPermission,
} from "../deviceCompassHeading";

describe("needsDeviceOrientationPermission", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns true when requestPermission exists", () => {
		vi.stubGlobal("DeviceOrientationEvent", {
			requestPermission: () => Promise.resolve("granted"),
		});

		expect(needsDeviceOrientationPermission()).toBe(true);
	});

	it("returns false when requestPermission is missing", () => {
		vi.stubGlobal("DeviceOrientationEvent", {});

		expect(needsDeviceOrientationPermission()).toBe(false);
	});
});

describe("getCompassHeadingFromEvent", () => {
	it("uses webkitCompassHeading on iOS", () => {
		const event = {
			alpha: null,
			absolute: false,
			webkitCompassHeading: 123,
		} as unknown as DeviceOrientationEvent;

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
