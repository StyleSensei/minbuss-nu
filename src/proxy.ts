import { getConfiguredOperators } from "@shared/config/gtfsOperators";
import {
	getRegionPathSlugForOperator,
	resolveOperatorFromRegionPathWithConfig,
} from "@shared/config/realtimeRegionPaths";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LEGACY_STOCKHOLM_PATH = "/realtid-bussar-stockholm";
const REGION_PREFIX = "/realtid-bussar/";

function normalizePathname(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith("/")) {
		return pathname.slice(0, -1);
	}
	return pathname;
}

function decodeSegment(raw: string): string {
	try {
		return decodeURIComponent(raw).toLowerCase();
	} catch {
		return raw.toLowerCase();
	}
}

export function proxy(request: NextRequest) {
	const p = normalizePathname(request.nextUrl.pathname);
	const url = request.nextUrl.clone();
	const configured = getConfiguredOperators();

	if (p === LEGACY_STOCKHOLM_PATH) {
		const op = url.searchParams.get("operator")?.trim().toLowerCase() ?? "";
		if (op && op !== "sl" && configured.includes(op)) {
			url.pathname = `${REGION_PREFIX}${encodeURIComponent(getRegionPathSlugForOperator(op))}`;
		} else {
			url.pathname = `${REGION_PREFIX}stockholm`;
		}
		url.searchParams.delete("operator");
		return NextResponse.redirect(url, 308);
	}

	if (p === `${REGION_PREFIX}sl`) {
		url.pathname = `${REGION_PREFIX}stockholm`;
		url.searchParams.delete("operator");
		return NextResponse.redirect(url, 308);
	}

	if (p.startsWith(REGION_PREFIX)) {
		const rest = p.slice(REGION_PREFIX.length).split("/")[0] ?? "";
		const segment = decodeSegment(rest);

		if (segment) {
			if (configured.includes(segment)) {
				const canon = getRegionPathSlugForOperator(segment);
				if (canon !== segment) {
					url.pathname = `${REGION_PREFIX}${encodeURIComponent(canon)}`;
					url.searchParams.delete("operator");
					return NextResponse.redirect(url, 308);
				}
			}

			const opQ = url.searchParams.get("operator")?.trim().toLowerCase() ?? "";
			const opFromPath = resolveOperatorFromRegionPathWithConfig(
				segment,
				configured,
			);
			if (opFromPath && opQ === opFromPath) {
				url.searchParams.delete("operator");
				if (url.search !== request.nextUrl.search) {
					return NextResponse.redirect(url, 308);
				}
			}
		}
	}

	if (p === `${REGION_PREFIX}stockholm`) {
		const op = url.searchParams.get("operator")?.trim().toLowerCase() ?? "";
		if (op && op !== "sl" && configured.includes(op)) {
			url.pathname = `${REGION_PREFIX}${encodeURIComponent(getRegionPathSlugForOperator(op))}`;
			url.searchParams.delete("operator");
			return NextResponse.redirect(url, 308);
		}
		if (op === "sl") {
			url.searchParams.delete("operator");
			if (url.search !== request.nextUrl.search) {
				return NextResponse.redirect(url, 308);
			}
		}
	}

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-pathname", request.nextUrl.pathname);

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
};
