import { NextResponse } from "next/server";
import { selectAllroutes } from "@/app/services/dataProcessors/selectAllRoutes";
import { get } from "@vercel/blob";

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
	const routes = await selectAllroutes(feedVersion);
	return NextResponse.json({ routes });
}
