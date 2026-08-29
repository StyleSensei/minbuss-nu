/** Över denna hastighet prioriteras GPS-riktning framför kompassen. */
export const GPS_HEADING_PREFERRED_SPEED_MPS = 1;

export function resolveUserHeading(options: {
	gpsHeading: number | null;
	compassHeading: number | null;
	lastHeading: number | null;
	speed: number | null;
}): number | null {
	const { gpsHeading, compassHeading, lastHeading, speed } = options;
	const moving =
		speed != null &&
		Number.isFinite(speed) &&
		speed >= GPS_HEADING_PREFERRED_SPEED_MPS;

	// Stale GPS-heading ska inte blockera kompassen när användaren står still.
	const effectiveGpsHeading = moving ? gpsHeading : null;

	if (effectiveGpsHeading != null) return effectiveGpsHeading;
	if (compassHeading != null) return compassHeading;
	return gpsHeading ?? lastHeading;
}
