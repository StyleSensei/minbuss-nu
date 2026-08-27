const GOLDEN_ANGLE_DEGREES = 137.508;

export function createRouteShapeColorMap(
	routeNames: string[],
): Map<string, string> {
	const uniqueRoutes = [
		...new Set(routeNames.map((name) => name.trim()).filter(Boolean)),
	].sort((a, b) => a.localeCompare(b, "sv"));

	return new Map(
		uniqueRoutes.map((route, index) => [
			route,
			`hsl(${Math.round((index * GOLDEN_ANGLE_DEGREES) % 360)} 78% 52%)`,
		]),
	);
}

export function colorForRoute(
	routeColors: Map<string, string> | undefined,
	routeShortName: string | undefined,
): string | undefined {
	const name = routeShortName?.trim();
	if (!routeColors || !name) return undefined;
	return routeColors.get(name);
}
