import { NextResponse } from "next/server";
import {
	getConfiguredOperators,
	getDefaultOperator,
} from "@/shared/config/gtfsOperators";

export const revalidate = 3600;

export async function GET() {
	const t0 = Date.now();
	const operators = getConfiguredOperators();
	const defaultOperator = getDefaultOperator();
	const durationMs = Date.now() - t0;
	return NextResponse.json(
		{ operators, defaultOperator },
		{
			headers: {
				"x-handler-duration-ms": String(durationMs),
				"x-server-uptime-ms": String(Math.floor(process.uptime() * 1000)),
			},
		},
	);
}
