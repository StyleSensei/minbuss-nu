import { describe, expect, it } from "vitest";
import { convertGTFSTimeToDate } from "../convertGTFSTimeToDate";

describe("convertGTFSTimeToDate", () => {
	const lateEvening = new Date(2026, 7, 26, 22, 50);

	it("maps early times to tomorrow during a late-evening window", () => {
		const result = convertGTFSTimeToDate("10:30:00", lateEvening);

		expect(result.getDate()).toBe(27);
		expect(result.getHours()).toBe(10);
		expect(result.getMinutes()).toBe(30);
	});

	it("maps GTFS hours above 24 to tomorrow", () => {
		const result = convertGTFSTimeToDate("24:49:00", lateEvening);

		expect(result.getDate()).toBe(27);
		expect(result.getHours()).toBe(0);
		expect(result.getMinutes()).toBe(49);
	});

	it("keeps a recently departed trip within the grace period", () => {
		const result = convertGTFSTimeToDate("22:40:00", lateEvening);

		expect(result.getDate()).toBe(26);
		expect(result.getHours()).toBe(22);
	});
});
