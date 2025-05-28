import { extractZip } from "@/app/services/dataProcessors/extractZip";
import { saveToDatabase } from "@/app/services/dataProcessors/saveToDatabase";
import type { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
	const authHeader = request.headers.get("authorization");
	console.log("Received auth header:", authHeader);
	console.log("Expected auth header:", `Bearer ${process.env.CRON_SECRET}`);

	if (!authHeader) {
		console.log("No authorization header provided");
		return new Response("Unauthorized - No header", {
			status: 401,
		});
	}

	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		console.log("Authorization header mismatch");
		return new Response("Unauthorized - Invalid token", {
			status: 401,
		});
	}

	try {
		console.time("extractZip");
		const { routes, trips, stops, stopTimes } = await extractZip();
		console.timeEnd("extractZip");

		try {
			await saveToDatabase(routes, "routes");
		} catch (error) {
			console.error("Error saving routes to database:", error);
		}

		try {
			await saveToDatabase(trips, "trips");
		} catch (error) {
			console.error("Error saving trips to database:", error);
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
