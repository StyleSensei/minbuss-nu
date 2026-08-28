import { type NextRequest, NextResponse } from "next/server";
import {
	peekCachedStopShapes,
	streamUncachedStopBoardShapes,
} from "@/app/services/cacheHelper";
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
		const cached = await peekCachedStopShapes(stopId, operator);
		if (cached) {
			return NextResponse.json(
				{ shapes: cached },
				{
					headers: {
						"Cache-Control":
							"public, s-maxage=86400, stale-while-revalidate=604800",
					},
				},
			);
		}

		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					await streamUncachedStopBoardShapes(stopId, operator, (event) => {
						controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
					});
					controller.close();
				} catch (error) {
					controller.error(error);
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "application/x-ndjson; charset=utf-8",
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		console.error("Error fetching stop shapes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stop shapes" },
			{ status: 500 },
		);
	}
}
