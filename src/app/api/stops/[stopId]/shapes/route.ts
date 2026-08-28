import { type NextRequest, NextResponse } from "next/server";
import { getCachedStopShapes } from "@/app/services/cacheHelper";
import { resolveOperator } from "@/shared/config/gtfsOperators";

export const revalidate = 86400;
export const maxDuration = 60;

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ stopId: string }> },
) {
	const operator = resolveOperator(
		request.nextUrl.searchParams.get("operator"),
	);
	const { stopId: rawStopId } = await context.params;
	const stopId = decodeURIComponent(rawStopId).trim();
	if (!stopId) {
		return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
	}

	try {
		const shapes = await getCachedStopShapes(stopId, operator);
		return NextResponse.json(
			{ shapes },
			{
				headers: {
					"Cache-Control":
						"public, s-maxage=86400, stale-while-revalidate=604800",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching stop shapes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stop shapes" },
			{ status: 500 },
		);
	}
}
