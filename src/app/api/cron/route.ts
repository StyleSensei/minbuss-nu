import { extractZip } from "@/app/services/dataProcessors/extractZip";
import { saveToDatabase } from "@/app/services/dataProcessors/saveToDatabase";
import type { NextRequest } from "next/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return new Response("Unauthorized", {
			status: 401,
		});
	}
	try {
		console.time("extractZip");
		const { routes, trips, stops, stopTimes } = await extractZip();
		console.timeEnd("extractZip");

		try {
			await saveToDatabase(trips, "trips");
		} catch (error) {
			console.error("Error saving trips to database:", error);
		}

		try {
			await saveToDatabase(routes, "routes");
		} catch (error) {
			console.error("Error saving routes to database:", error);
		}

		try {
			await saveToDatabase(stops, "stops");
		} catch (error) {
			console.error("Error saving stops to database:", error);
		}

		try {
			await saveToDatabase(stopTimes, "stop_times");
		} catch (error) {
			console.error("Error saving stop_times to database:", error);
		}

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error processing data:", error);
		return new Response("Internal Server Error", {
			status: 500,
		});
	}
}
