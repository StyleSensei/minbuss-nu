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
