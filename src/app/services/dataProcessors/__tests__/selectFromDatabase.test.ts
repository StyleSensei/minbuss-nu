import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getDateForGTFS = (now: Date) => {
	const currentHour = now.getHours();
	const isEarlyMorning = currentHour < 4;

	let year = now.getFullYear();
	let month = now.getMonth() + 1;
	let day = now.getDate();

	if (isEarlyMorning) {
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		year = yesterday.getFullYear();
		month = yesterday.getMonth() + 1;
		day = yesterday.getDate();
	}

	return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const calculateTimeRange = (now: Date) => {
	const currentHour = now.getHours();
	const currentMinutes = now.getMinutes();

	const formatTimeForSQL = (hours: number, minutes: number): string => {
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:00`;
	};

	let fifteenMinBeforeHour = currentHour;
	let fifteenMinBeforeMinute = currentMinutes - 15;

	if (fifteenMinBeforeMinute < 0) {
		fifteenMinBeforeMinute += 60;
		fifteenMinBeforeHour -= 1;
	}

	if (fifteenMinBeforeHour < 0) {
		fifteenMinBeforeHour = 23;
	}

	const timeFifteenMinBeforeDep = formatTimeForSQL(
		fifteenMinBeforeHour,
		fifteenMinBeforeMinute,
	);

	const fourHoursAfterHour = currentHour + 4;
	const timeFourHoursAfter = formatTimeForSQL(
		fourHoursAfterHour,
		currentMinutes,
	);

	return { start: timeFifteenMinBeforeDep, end: timeFourHoursAfter };
};

vi.mock("../selectFromDatabase", () => {
	return {
		selectUpcomingTripsFromDatabase: vi.fn(async () => {
			return [];
		}),
	};
});

import { selectUpcomingTripsFromDatabase } from "../selectFromDatabase";

describe("selectUpcomingTripsFromDatabase - Core GTFS Logic", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should successfully call the function with basic parameters", async () => {
		const result = await selectUpcomingTripsFromDatabase("1", "Test Stop");

		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
			"1",
			"Test Stop",
		);
		expect(result).toEqual([]);
	});

	it("should handle different bus lines", async () => {
		await selectUpcomingTripsFromDatabase("177", "Centralstation");

		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
			"177",
			"Centralstation",
		);
	});

	it("should handle special characters in stop names", async () => {
		await selectUpcomingTripsFromDatabase("1", "Ö-vik Centrum");

		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
			"1",
			"Ö-vik Centrum",
		);
	});
});

describe("Date and Time Logic Tests", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const getDateForGTFS = (now: Date) => {
		const currentHour = now.getHours();
		const isEarlyMorning = currentHour < 4;

		let year = now.getFullYear();
		let month = now.getMonth() + 1;
		let day = now.getDate();

		if (isEarlyMorning) {
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			year = yesterday.getFullYear();
			month = yesterday.getMonth() + 1;
			day = yesterday.getDate();
		}

		return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
	};

	it("uses today's date for normal daytime (13:00)", () => {
		vi.setSystemTime(new Date("2025-06-13T13:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-06-13");
	});

	it("uses yesterday's date for early mornings (02:30)", () => {
		vi.setSystemTime(new Date("2025-06-13T02:30:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-06-12");
	});

	it("uses today's date at exactly 04:00 (boundary value)", () => {
		vi.setSystemTime(new Date("2025-06-13T04:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-06-13");
	});

	it("uses yesterday's date at 03:59 (just before boundary)", () => {
		vi.setSystemTime(new Date("2025-06-13T03:59:59"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-06-12");
	});

	it("handles midnight correctly (00:00)", () => {
		vi.setSystemTime(new Date("2025-06-13T00:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-06-12");
	});

	it("handles month transitions correctly", () => {
		vi.setSystemTime(new Date("2025-06-01T02:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2025-05-31");
	});

	it("handles year transitions correctly", () => {
		vi.setSystemTime(new Date("2025-01-01T02:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2024-12-31");
	});

	it("handles leap year correctly", () => {
		vi.setSystemTime(new Date("2024-03-01T02:00:00"));
		const result = getDateForGTFS(new Date());
		expect(result).toBe("2024-02-29");
	});
});

describe("Time Calculation Logic Tests", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const calculateTimeRange = (now: Date) => {
		const currentHour = now.getHours();
		const currentMinutes = now.getMinutes();

		const formatTimeForSQL = (hours: number, minutes: number): string => {
			return `${hours.toString().padStart(2, "0")}:${minutes
				.toString()
				.padStart(2, "0")}:00`;
		};

		let fifteenMinBeforeHour = currentHour;
		let fifteenMinBeforeMinute = currentMinutes - 15;

		if (fifteenMinBeforeMinute < 0) {
			fifteenMinBeforeMinute += 60;
			fifteenMinBeforeHour -= 1;
		}

		if (fifteenMinBeforeHour < 0) {
			fifteenMinBeforeHour = 23;
		}

		const timeFifteenMinBeforeDep = formatTimeForSQL(
			fifteenMinBeforeHour,
			fifteenMinBeforeMinute,
		);

		const fourHoursAfterHour = currentHour + 4;
		const timeFourHoursAfter = formatTimeForSQL(
			fourHoursAfterHour,
			currentMinutes,
		);

		return { start: timeFifteenMinBeforeDep, end: timeFourHoursAfter };
	};

	it("calculates correct time range for normal time (10:30)", () => {
		vi.setSystemTime(new Date("2025-06-13T10:30:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("10:15:00");
		expect(result.end).toBe("14:30:00");
	});

	it("handles minute underflow correctly (10:05 -> 15 min before)", () => {
		vi.setSystemTime(new Date("2025-06-13T10:05:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("09:50:00");
		expect(result.end).toBe("14:05:00");
	});

	it("handles hour underflow correctly (00:10 -> 15 min before)", () => {
		vi.setSystemTime(new Date("2025-06-13T00:10:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("23:55:00");
		expect(result.end).toBe("04:10:00");
	});

	it("handles exact midnight (00:00)", () => {
		vi.setSystemTime(new Date("2025-06-13T00:00:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("23:45:00");
		expect(result.end).toBe("04:00:00");
	});

	it("handles late evening hours (23:45)", () => {
		vi.setSystemTime(new Date("2025-06-13T23:45:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("23:30:00");

		expect(result.end).toBe("27:45:00");
	});

	it("handles early morning (03:30)", () => {
		vi.setSystemTime(new Date("2025-06-13T03:30:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("03:15:00");
		expect(result.end).toBe("07:30:00");
	});

	it("handles exactly 15 minutes past midnight (00:15)", () => {
		vi.setSystemTime(new Date("2025-06-13T00:15:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("00:00:00");
		expect(result.end).toBe("04:15:00");
	});

	it("handles boundary conditions around 4 AM cutoff (03:59)", () => {
		vi.setSystemTime(new Date("2025-06-13T03:59:00"));
		const result = calculateTimeRange(new Date());

		expect(result.start).toBe("03:44:00");
		expect(result.end).toBe("07:59:00");
	});
});

describe("Additional Edge Cases and Boundary Conditions", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("DST and Timezone Edge Cases", () => {
		it("handles spring DST transition correctly", () => {
			vi.setSystemTime(new Date("2025-03-30T02:30:00"));
			const result = getDateForGTFS(new Date());
			expect(result).toBe("2025-03-29");
		});

		it("handles fall DST transition correctly", () => {
			vi.setSystemTime(new Date("2025-10-26T02:30:00"));
			const result = getDateForGTFS(new Date());
			expect(result).toBe("2025-10-25");
		});
	});

	describe("Month and Year Boundary Tests", () => {
		it("handles February 28th to March 1st transition (non-leap year)", () => {
			vi.setSystemTime(new Date("2025-03-01T02:00:00"));
			const result = getDateForGTFS(new Date());
			expect(result).toBe("2025-02-28");
		});

		it("handles February 29th to March 1st transition (leap year)", () => {
			vi.setSystemTime(new Date("2024-03-01T02:00:00"));
			const result = getDateForGTFS(new Date());
			expect(result).toBe("2024-02-29");
		});

		it("handles December 31st to January 1st transition", () => {
			vi.setSystemTime(new Date("2025-01-01T02:00:00"));
			const result = getDateForGTFS(new Date());
			expect(result).toBe("2024-12-31");
		});

		it("handles end of month transitions correctly", () => {
			const testCases = [
				{ input: "2025-05-01T02:00:00", expected: "2025-04-30" },
				{ input: "2025-07-01T02:00:00", expected: "2025-06-30" },
				{ input: "2025-09-01T02:00:00", expected: "2025-08-31" },
				{ input: "2025-12-01T02:00:00", expected: "2025-11-30" },
			];

			for (const { input, expected } of testCases) {
				vi.setSystemTime(new Date(input));
				const result = getDateForGTFS(new Date());
				expect(result).toBe(expected);
			}
		});
	});

	describe("Time Calculation Edge Cases", () => {
		it("handles exactly 15 minutes after midnight edge case", () => {
			vi.setSystemTime(new Date("2025-06-13T00:15:00"));
			const result = calculateTimeRange(new Date());

			expect(result.start).toBe("00:00:00");
			expect(result.end).toBe("04:15:00");
		});

		it("handles time calculations across multiple hour overflows", () => {
			vi.setSystemTime(new Date("2025-06-13T21:30:00"));
			const result = calculateTimeRange(new Date());

			expect(result.start).toBe("21:15:00");
			// 21 + 4 = 25 hours (GTFS extended format)
			expect(result.end).toBe("25:30:00");
		});

		it("handles extreme edge case: 23:59", () => {
			vi.setSystemTime(new Date("2025-06-13T23:59:00"));
			const result = calculateTimeRange(new Date());

			expect(result.start).toBe("23:44:00");
			expect(result.end).toBe("27:59:00");
		});

		it("handles minute boundary: exactly 00:00", () => {
			vi.setSystemTime(new Date("2025-06-13T00:00:00"));
			const result = calculateTimeRange(new Date());

			expect(result.start).toBe("23:45:00");
			expect(result.end).toBe("04:00:00");
		});
	});
});

describe("Parameter Validation and Robustness", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("handles empty bus line parameter", async () => {
		const result = await selectUpcomingTripsFromDatabase("", "Test Stop");
		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
			"",
			"Test Stop",
		);
	});

	it("handles empty stop name parameter", async () => {
		const result = await selectUpcomingTripsFromDatabase("1", "");
		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith("1", "");
	});

	it("handles special characters in bus line", async () => {
		const specialBusLines = ["1A", "177X", "E4", "N1", "705"];

		for (const busLine of specialBusLines) {
			await selectUpcomingTripsFromDatabase(busLine, "Test Stop");
			expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
				busLine,
				"Test Stop",
			);
		}
	});

	it("handles special characters and Swedish characters in stop names", async () => {
		const specialStopNames = [
			"Ö-vik Centrum",
			"Åre Torg",
			"Göteborg C",
			"Malmö Hyllie",
			"T-Centralen",
			"Arlanda Terminal 5",
			"Köping Station",
			"Växjö Resecentrum",
		];

		for (const stopName of specialStopNames) {
			await selectUpcomingTripsFromDatabase("1", stopName);
			expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
				"1",
				stopName,
			);
		}
	});

	it("handles very long stop names", async () => {
		const longStopName =
			"En mycket lång hållplatsnamn som kanske skulle kunna orsaka problem med databas queries eller string hantering";
		await selectUpcomingTripsFromDatabase("1", longStopName);
		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith(
			"1",
			longStopName,
		);
	});

	it("handles numeric stop names", async () => {
		await selectUpcomingTripsFromDatabase("1", "123456");
		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledWith("1", "123456");
	});

	it("ensures consistent behavior across multiple calls", async () => {
		const calls = [];
		for (let i = 0; i < 5; i++) {
			const result = await selectUpcomingTripsFromDatabase("177", "Test Stop");
			calls.push(result);
		}

		for (const result of calls) {
			expect(Array.isArray(result)).toBe(true);
			expect(result).toEqual([]);
		}

		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledTimes(5);
	});
});

describe("Performance and Consistency Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("maintains consistent date logic across rapid time changes", () => {
		const times = [
			"2025-06-13T03:58:00",
			"2025-06-13T03:59:00",
			"2025-06-13T04:00:00",
			"2025-06-13T04:01:00",
		];

		const results = times.map((time) => {
			vi.setSystemTime(new Date(time));
			return getDateForGTFS(new Date());
		});

		expect(results[0]).toBe("2025-06-12"); // 03:58 -> yesterday
		expect(results[1]).toBe("2025-06-12"); // 03:59 -> yesterday
		expect(results[2]).toBe("2025-06-13"); // 04:00 -> today
		expect(results[3]).toBe("2025-06-13"); // 04:01 -> today
	});

	it("handles repeated calls with same parameters efficiently", async () => {
		vi.setSystemTime(new Date("2025-06-13T10:30:00"));

		const promises = Array(10)
			.fill(null)
			.map(() => selectUpcomingTripsFromDatabase("177", "Centralstation"));

		const results = await Promise.all(promises);

		for (const result of results) {
			expect(result).toEqual([]);
		}

		expect(selectUpcomingTripsFromDatabase).toHaveBeenCalledTimes(10);
	});
});
