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
		const { routes, trips } = await extractZip();
		console.timeEnd("extractZip");

		await saveToDatabase(trips, "trips");
		await saveToDatabase(routes, "routes");

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error processing data:", error);
		return new Response("Internal Server Error", {
			status: 500,
		});
	}
}
