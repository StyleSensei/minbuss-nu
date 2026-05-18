import { useEffect, useRef, useState } from "react";
import type { IUser } from "../../../hooks/useUserPosition";

const GEO_WAIT_MS = 4000;

/**
 * Väntar med att montera GoogleMap tills vi har användarposition (eller timeout),
 * och låser initial center en gång så defaultCenter inte hoppar mellan Stockholm och GPS.
 */
export function useMapInitialCenter(
	userPosition: IUser | null,
	operatorDefaultCenter: google.maps.LatLngLiteral,
	linjeParam: string,
) {
	const initialCenterRef = useRef<google.maps.LatLngLiteral | null>(null);
	const [geoWaitExpired, setGeoWaitExpired] = useState(false);

	useEffect(() => {
		if (userPosition || linjeParam) return;
		const timer = setTimeout(() => setGeoWaitExpired(true), GEO_WAIT_MS);
		return () => clearTimeout(timer);
	}, [userPosition, linjeParam]);

	const mapMountReady =
		Boolean(linjeParam) || Boolean(userPosition) || geoWaitExpired;

	let mapInitialCenter = initialCenterRef.current;
	if (mapMountReady && mapInitialCenter === null) {
		mapInitialCenter = userPosition
			? { lat: userPosition.lat, lng: userPosition.lng }
			: operatorDefaultCenter;
		initialCenterRef.current = mapInitialCenter;
	}

	return {
		mapMountReady,
		mapInitialCenter,
	};
}
