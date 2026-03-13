import {
	getCachedDbData,
	getCachedTripUpdates,
	getCachedVehiclePositions,
} from "@/app/services/cacheHelper";

export async function GET() {
	await Promise.all([
		getCachedVehiclePositions(),
		getCachedTripUpdates(),
		getCachedDbData("177"),
	]);
	return new Response("ok", {
		status: 200,
	});
}
