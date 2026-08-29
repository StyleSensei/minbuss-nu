/** Bearing in degrees from point 1 to point 2 (0 = north, clockwise). */
export function getBearingFromLatLon(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const toRad = (deg: number) => deg * (Math.PI / 180);
	const toDeg = (rad: number) => (rad * 180) / Math.PI;

	const phi1 = toRad(lat1);
	const phi2 = toRad(lat2);
	const deltaLambda = toRad(lon2 - lon1);

	const y = Math.sin(deltaLambda) * Math.cos(phi2);
	const x =
		Math.cos(phi1) * Math.sin(phi2) -
		Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
	const theta = Math.atan2(y, x);

	return (toDeg(theta) + 360) % 360;
}
