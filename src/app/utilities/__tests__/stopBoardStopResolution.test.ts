import { describe, expect, it } from "vitest";
import {
	hasDisplayablePlatformCode,
	shouldExpandStopBoardToStation,
} from "../stopBoardStopResolution";

describe("stop board station resolution", () => {
	it("keeps a child with a platform code scoped to itself", () => {
		expect(shouldExpandStopBoardToStation(0, "parent", "A")).toBe(false);
	});

	it("expands a platformless child to all siblings", () => {
		expect(shouldExpandStopBoardToStation(0, "parent", null)).toBe(true);
	});

	it("keeps a platformless orphan scoped to itself", () => {
		expect(shouldExpandStopBoardToStation(0, null, null)).toBe(false);
	});

	it("expands parent stations and entrances", () => {
		expect(shouldExpandStopBoardToStation(1, null, null)).toBe(true);
		expect(shouldExpandStopBoardToStation(2, "parent", null)).toBe(true);
	});

	it("treats internal OLD platform values as missing", () => {
		expect(hasDisplayablePlatformCode("OLD2")).toBe(false);
		expect(shouldExpandStopBoardToStation(0, "parent", "OLD2")).toBe(true);
	});
});
