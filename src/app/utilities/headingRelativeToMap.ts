/** Riktning relativt kartans rotation (0° = uppåt på kartan). */
export function headingRelativeToMap(
	heading: number,
	mapBearing: number,
): number {
	return (heading - mapBearing + 360) % 360;
}
