import { describe, expect, it } from "vitest";
import {
	isStopMarkerActive,
	resolveActiveStopMarkerId,
} from "../mapClient/mapClientStopUi";

const parentStop = {
	id: "parent",
	isParent: true,
};

const childStop = {
	id: "child-1",
	parent: "parent",
	isParent: false,
};

const siblingStop = {
	id: "child-2",
	parent: "parent",
	isParent: false,
};

const platformLabel = {
	id: "child-1",
	parent: "parent",
	isParent: false,
	presentation: "platform-label" as const,
};

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

describe("isStopMarkerActive", () => {
	it("activates children when the parent was clicked and then replaced on zoom-in", () => {
		expect(
			isStopMarkerActive(childStop, "parent", new Set(), true),
		).toBe(true);
		expect(
			isStopMarkerActive(siblingStop, "parent", new Set(), true),
		).toBe(true);
	});

	it("activates the parent and siblings when a child was clicked", () => {
		const focused = new Set(["parent"]);
		expect(isStopMarkerActive(parentStop, "child-1", focused, true)).toBe(
			true,
		);
		expect(isStopMarkerActive(siblingStop, "child-1", focused, true)).toBe(
			true,
		);
		expect(isStopMarkerActive(childStop, "child-1", focused, true)).toBe(true);
	});

	it("activates the whole station group from search without a map click", () => {
		const focused = new Set(["parent"]);
		expect(isStopMarkerActive(parentStop, "parent", focused, true)).toBe(true);
		expect(isStopMarkerActive(childStop, "parent", focused, true)).toBe(true);
	});

	it("does not activate platform labels", () => {
		expect(
			isStopMarkerActive(platformLabel, "parent", new Set(["parent"]), true),
		).toBe(false);
	});

	it("does not activate compact markers that are not group-stops", () => {
		expect(
			isStopMarkerActive(parentStop, "parent", new Set(), false),
		).toBe(false);
	});
});
