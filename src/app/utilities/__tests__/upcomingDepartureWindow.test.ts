import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { TimeThresholds } from "../calculateTimeFilter";
import {
	buildUpcomingServiceDayWindows,
	compareDeparturesChronologically,
	departureSortEpochMs,
	getEarlyMorningEndTimeMinutes,
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

	it("at 02:30 includes overnight trips from 23:30 via early-morning SQL path thresholds", () => {
		const dt = stockholm("2026-08-28T02:30:00");
		const endTimeMinutes = getEarlyMorningEndTimeMinutes(dt.hour, dt.minute, 12);

		expect(isGtfsEarlyMorning(dt.hour)).toBe(true);
		expect(TimeThresholds.THIRTY_MIN_BEFORE_MIDNIGHT).toBe(23 * 60 + 30);
		expect(25 * 60 + 30).toBeGreaterThanOrEqual(
			TimeThresholds.THIRTY_MIN_BEFORE_MIDNIGHT,
		);
		expect(endTimeMinutes).toBe((2 + 12 + 24) * 60 + 30);
	});
});
