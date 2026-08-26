import { describe, expect, it } from "vitest";
import { mergeDuplicateStopsByName } from "../searchBarHelpers";

describe("mergeDuplicateStopsByName", () => {
	it("normalizes same-name platforms from multiple parents to one station result", () => {
		const [result] = mergeDuplicateStopsByName([
			{
				stop_id: "subway-platform",
				stop_name: "Brommaplan",
				stop_lat: 59.338284,
				stop_lon: 17.939641,
				location_type: 0,
				parent_station: "subway-parent",
				platform_code: "1",
				routes: ["17", "18"],
			},
			{
				stop_id: "bus-platform",
				stop_name: "Brommaplan",
				stop_lat: 59.338233,
				stop_lon: 17.937424,
				location_type: 0,
				parent_station: "bus-parent",
				platform_code: "B",
				routes: ["117", "177"],
			},
		]);

		expect(result.stop_id).toBe("subway-parent");
		expect(result.location_type).toBe(1);
		expect(result.platform_code).toBeNull();
		expect(result.routes).toEqual(["117", "17", "177", "18"]);
	});
});
