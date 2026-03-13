import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";
import { selectAllroutes } from "@/app/services/dataProcessors/selectAllRoutes";

export const revalidate = 2592000; // 30 days

export async function GET() {
	const result = await get("feed-version.json", { access: "private" });
	if (!result || result.statusCode !== 200 || !result.stream) {
		return NextResponse.json(
			{ error: "feed-version.json not found" },
			{ status: 404 },
		);
	}
	const text = await new Response(result.stream).text();
	const { feedVersion } = JSON.parse(text) as { feedVersion: string };

	const data = await selectAllroutes(feedVersion);
	const routesArray = data
		.map((route) => route.line)
		.filter((route): route is string => route !== null);

	const routesObject: Record<string, boolean> = {};
	for (const route of routesArray) {
		routesObject[route] = true;
	}

	return NextResponse.json(
		{ asObject: routesObject, asArray: routesArray },
		{
			headers: {
				"Cache-Control":
					"public, s-maxage=2592000, stale-while-revalidate=604800",
			},
		},
	);
}
