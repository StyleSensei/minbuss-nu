import { NextResponse } from "next/server";
import {
	getConfiguredOperators,
	getDefaultOperator,
} from "@/shared/config/gtfsOperators";

export const revalidate = 3600;

export async function GET() {
	const operators = getConfiguredOperators();
	const defaultOperator = getDefaultOperator();
	return NextResponse.json({ operators, defaultOperator });
}
