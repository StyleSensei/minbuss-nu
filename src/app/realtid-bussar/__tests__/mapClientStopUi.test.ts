import { describe, expect, it } from "vitest";
import { resolveActiveStopMarkerId } from "../mapClient/mapClientStopUi";

describe("resolveActiveStopMarkerId", () => {
	it("highlights the clicked child instead of the parent station", () => {
		expect(resolveActiveStopMarkerId("child-1", null, "parent", true)).toBe(
			"child-1",
		);
	});

	it("falls back to platform filter or parent when nothing was clicked on the map", () => {
		expect(resolveActiveStopMarkerId(null, "platform-a", "parent", true)).toBe(
			"platform-a",
		);
		expect(resolveActiveStopMarkerId(null, null, "parent", true)).toBe(
			"parent",
		);
		expect(
			resolveActiveStopMarkerId(null, null, "parent", false),
		).toBeUndefined();
	});
});
