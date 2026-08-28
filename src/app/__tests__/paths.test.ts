import { describe, expect, it } from "vitest";
import {
	lineSearchUrl,
	searchPathForOperator,
	searchUrlWithoutLine,
	searchUrlWithoutStop,
	STOP_SEARCH_QUERY,
	stopSearchUrl,
} from "../paths";

describe("stopSearchUrl", () => {
	it("writes hallplats as the only query param, like linje for line search", () => {
		const url = stopSearchUrl("9022001000001001", "sl");
		expect(url).toBe(
			`${searchPathForOperator("sl")}?${STOP_SEARCH_QUERY}=9022001000001001`,
		);
	});

	it("does not keep linje when a stop is selected", () => {
		expect(stopSearchUrl("abc", "sl")).not.toContain("linje=");
		expect(lineSearchUrl("177", "sl")).not.toContain(`${STOP_SEARCH_QUERY}=`);
	});
});

describe("searchUrlWithoutStop", () => {
	it("removes hallplats and keeps other params", () => {
		const url = searchUrlWithoutStop(
			"sl",
			"hallplats=stop-1&focusUser=1",
		);
		expect(url).toBe(`${searchPathForOperator("sl")}?focusUser=1`);
	});

	it("returns a bare region path when hallplats was the only param", () => {
		expect(searchUrlWithoutStop("sl", "hallplats=stop-1")).toBe(
			searchPathForOperator("sl"),
		);
	});
});

describe("searchUrlWithoutLine", () => {
	it("removes linje and mapfit without dropping hallplats", () => {
		const url = searchUrlWithoutLine(
			"sl",
			"linje=177&mapfit=1&hallplats=stop-1",
		);
		expect(url).toBe(
			`${searchPathForOperator("sl")}?${STOP_SEARCH_QUERY}=stop-1`,
		);
	});
});
