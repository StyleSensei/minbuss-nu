// @see https://www.geeksforgeeks.org/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
export const getDistanceFromLatLon = (
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
) => {
	const convertLatLonToRadians = (degree: number) => degree * (Math.PI / 180);

	const EARTH_RADIUS_METERS = 6371000;
	const radianForLat1 = convertLatLonToRadians(lat1);
	const radianForLat2 = convertLatLonToRadians(lat2);
	const deltaLat = convertLatLonToRadians(lat2 - lat1);
	const deltaLon = convertLatLonToRadians(lon2 - lon1);

	// Haversine formula
	const a =
		Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
		Math.cos(radianForLat1) *
			Math.cos(radianForLat2) *
			Math.sin(deltaLon / 2) *
			Math.sin(deltaLon / 2);
	const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = EARTH_RADIUS_METERS * angularDistance; // Distance in meters
	return distance;
};
