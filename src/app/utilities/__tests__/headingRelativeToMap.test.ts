import { describe, expect, it } from "vitest";
import { headingRelativeToMap } from "../headingRelativeToMap";

describe("headingRelativeToMap", () => {
	it("behåller riktningen när kartan inte är roterad", () => {
		expect(headingRelativeToMap(90, 0)).toBe(90);
	});

	it("kompenserar för kartrotation", () => {
		expect(headingRelativeToMap(90, 90)).toBe(0);
	});

	it("hanterar wrap runt 0/360", () => {
		expect(headingRelativeToMap(10, 30)).toBe(340);
	});
});
