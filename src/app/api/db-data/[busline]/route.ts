import { NextResponse, type NextRequest } from "next/server";
import { getCachedDbData } from "@/app/services/cacheHelper";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 300; // 5 min

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ busline: string }> },
) {
	const { busline } = await context.params;
	if (!busline) {
		return NextResponse.json({ error: "Missing busline parameter" }, { status: 400 });
	}

	const { searchParams } = new URL(request.url);
	const stopName = searchParams.get("stopName") || undefined;
	const operator = resolveOperator(searchParams.get("operator"));

	try {
		const data = await getCachedDbData(busline, stopName, operator);
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
			},
		});
	} catch (error) {
		console.error("Error fetching db-data:", error);
		return NextResponse.json(
			{ error: "Failed to fetch db-data" },
			{ status: 500 },
		);
	}
}

