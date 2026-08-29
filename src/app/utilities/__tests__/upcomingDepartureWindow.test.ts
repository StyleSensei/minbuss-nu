import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
	buildUpcomingServiceDayWindows,
	compareDeparturesChronologically,
	departureInstantFromServiceDate,
	departureSortEpochMs,
	isGtfsEarlyMorning,
} from "../upcomingDepartureWindow";

const stockholm = (iso: string) =>
	DateTime.fromISO(iso, { zone: "Europe/Stockholm" });

describe("isGtfsEarlyMorning", () => {
	it("treats 03:59 as early morning", () => {
		expect(isGtfsEarlyMorning(3)).toBe(true);
	});

	it("treats 04:00 as normal morning", () => {
		expect(isGtfsEarlyMorning(4)).toBe(false);
	});
});

describe("compareDeparturesChronologically", () => {
	it("orders extended GTFS time on yesterday before same clock time today", () => {
		const yesterdayExtended = {
			serviceDate: "2026-08-27",
			departureTime: "31:35:00",
		};
		const todayRegular = {
			serviceDate: "2026-08-28",
			departureTime: "07:35:00",
		};

		expect(
			departureSortEpochMs(
				yesterdayExtended.serviceDate,
				yesterdayExtended.departureTime,
			),
		).toBe(
			departureSortEpochMs(todayRegular.serviceDate, todayRegular.departureTime),
		);
		expect(
			compareDeparturesChronologically(yesterdayExtended, todayRegular),
		).toBe(0);
	});

	it("sorts morning departures before later same-day trips", () => {
		const morning = {
			serviceDate: "2026-08-28",
			departureTime: "07:35:00",
		};
		const later = {
			serviceDate: "2026-08-28",
			departureTime: "11:00:00",
		};

		expect(compareDeparturesChronologically(morning, later)).toBeLessThan(0);
	});

	it("does not push all yesterday calendar rows before today (old orderBy bug)", () => {
		const departures = [
			{ serviceDate: "2026-08-27", departureTime: "43:00:00" },
			{ serviceDate: "2026-08-28", departureTime: "07:40:00" },
			{ serviceDate: "2026-08-27", departureTime: "31:35:00" },
			{ serviceDate: "2026-08-28", departureTime: "07:35:00" },
		];

		const sorted = [...departures].sort(compareDeparturesChronologically);

		expect(sorted[0].departureTime).toBe("31:35:00");
		expect(sorted[1].departureTime).toBe("07:35:00");
		expect(sorted[2].departureTime).toBe("07:40:00");
		expect(sorted[3].departureTime).toBe("43:00:00");
	});
});

describe("departureInstantFromServiceDate", () => {
	const nowAt0056 = stockholm("2026-08-29T00:56:00").toJSDate();

	it("maps yesterday evening service date to a past instant at 00:56", () => {
		const instant = departureInstantFromServiceDate("2026-08-28", "23:56:00");
		expect(instant.getTime()).toBeLessThan(nowAt0056.getTime());
	});

	it("maps same-day early morning service date to a past instant at 00:56", () => {
		const instant = departureInstantFromServiceDate("2026-08-29", "00:40:00");
		expect(instant.getTime()).toBeLessThan(nowAt0056.getTime());
	});

	it("maps same-day later departures to a future instant at 00:56", () => {
		const instant = departureInstantFromServiceDate("2026-08-29", "01:11:00");
		expect(instant.getTime()).toBeGreaterThan(nowAt0056.getTime());
	});

	it("sorts midnight board departures chronologically (Sandviksvägen scenario)", () => {
		const departures = [
			{ serviceDate: "2026-08-29", departureTime: "01:11:00" },
			{ serviceDate: "2026-08-29", departureTime: "02:10:00" },
			{ serviceDate: "2026-08-28", departureTime: "23:56:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:04:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:11:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:24:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:40:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:56:00" },
		];

		const sorted = [...departures].sort(compareDeparturesChronologically);

		expect(sorted.map((d) => d.departureTime)).toEqual([
			"23:56:00",
			"00:04:00",
			"00:11:00",
			"00:24:00",
			"00:40:00",
			"00:56:00",
			"01:11:00",
			"02:10:00",
		]);

		const upcoming = sorted.filter(
			(d) =>
				departureInstantFromServiceDate(d.serviceDate, d.departureTime).getTime() >
				nowAt0056.getTime(),
		);

		expect(upcoming.map((d) => d.departureTime)).toEqual(["01:11:00", "02:10:00"]);
	});

	it("filters out past departures at 01:04 (Sandviksvägen follow-up)", () => {
		const nowAt0104 = stockholm("2026-08-29T01:04:00").toMillis();
		const departures = [
			{ serviceDate: "2026-08-29", departureTime: "01:11:00" },
			{ serviceDate: "2026-08-29", departureTime: "02:10:00" },
			{ serviceDate: "2026-08-28", departureTime: "23:56:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:11:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:24:00" },
			{ serviceDate: "2026-08-29", departureTime: "00:56:00" },
		];

		const upcoming = departures.filter(
			(d) => departureSortEpochMs(d.serviceDate, d.departureTime) > nowAt0104,
		);

		expect(upcoming.map((d) => d.departureTime)).toEqual(["01:11:00", "02:10:00"]);
	});
});

describe("buildUpcomingServiceDayWindows", () => {
	it("includes yesterday extended window and today morning at 07:50", () => {
		const dt = stockholm("2026-08-28T07:50:00");
		const windows = buildUpcomingServiceDayWindows(dt, 12);

		const yesterday = windows.find((w) => w.serviceDate === "2026-08-27");
		const today = windows.find((w) => w.serviceDate === "2026-08-28");

		expect(yesterday).toBeDefined();
		expect(yesterday?.minMinutes).toBe(31 * 60 + 35);
		expect(today).toBeDefined();
		expect(today?.minMinutes).toBe(7 * 60 + 35);
	});

	it("excludes past departures at 01:04 (Sandviksvägen scenario)", () => {
		const dt = stockholm("2026-08-29T01:04:00");
		const windows = buildUpcomingServiceDayWindows(dt, 12);

		const includes = (serviceDate: string, departureTime: string) => {
			const [h, m] = departureTime.split(":").map(Number);
			const minutes = h * 60 + m;
			const window = windows.find((w) => w.serviceDate === serviceDate);
			if (!window) return false;
			return minutes >= window.minMinutes && minutes <= window.maxMinutes;
		};

		expect(includes("2026-08-29", "01:11:00")).toBe(true);
		expect(includes("2026-08-29", "02:10:00")).toBe(true);
		expect(includes("2026-08-28", "23:56:00")).toBe(false);
		expect(includes("2026-08-29", "00:11:00")).toBe(false);
		expect(includes("2026-08-29", "00:24:00")).toBe(false);
		// 00:56 is within the 15-minute lookback; client filters it after ~30 s grace.
		expect(includes("2026-08-29", "00:56:00")).toBe(true);
	});

	it("at 02:30 includes only recent overnight trips in the window", () => {
		const dt = stockholm("2026-08-28T02:30:00");
		const windows = buildUpcomingServiceDayWindows(dt, 12);

		const aug27 = windows.find((w) => w.serviceDate === "2026-08-27");
		expect(aug27).toBeDefined();
		expect(aug27?.minMinutes).toBe(26 * 60 + 15);
		expect(25 * 60 + 30).toBeLessThan(aug27?.minMinutes ?? 0);
	});
});
