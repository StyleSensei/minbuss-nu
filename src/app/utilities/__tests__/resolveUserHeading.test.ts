import { describe, expect, it } from "vitest";
import { resolveUserHeading } from "../resolveUserHeading";

describe("resolveUserHeading", () => {
	it("prioriterar kompass när användaren står still trots sparad GPS-heading", () => {
		expect(
			resolveUserHeading({
				gpsHeading: 10,
				compassHeading: 90,
				lastHeading: 10,
				speed: 0,
			}),
		).toBe(90);
	});

	it("prioriterar GPS vid tydlig förflyttning", () => {
		expect(
			resolveUserHeading({
				gpsHeading: 180,
				compassHeading: 90,
				lastHeading: 90,
				speed: 3,
			}),
		).toBe(180);
	});

	it("faller tillbaka till GPS när kompass saknas", () => {
		expect(
			resolveUserHeading({
				gpsHeading: 45,
				compassHeading: null,
				lastHeading: null,
				speed: 0,
			}),
		).toBe(45);
	});
});
