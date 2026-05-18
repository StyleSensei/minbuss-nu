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
	centerOnUser: boolean,
) {
	const initialCenterRef = useRef<google.maps.LatLngLiteral | null>(null);
	const [geoWaitExpired, setGeoWaitExpired] = useState(false);
	const positionForCenter = centerOnUser ? userPosition : null;

	useEffect(() => {
		if (positionForCenter || linjeParam || !centerOnUser) return;
		const timer = setTimeout(() => setGeoWaitExpired(true), GEO_WAIT_MS);
		return () => clearTimeout(timer);
	}, [positionForCenter, linjeParam, centerOnUser]);

	const mapMountReady =
		Boolean(linjeParam) ||
		Boolean(positionForCenter) ||
		geoWaitExpired ||
		!centerOnUser;

	let mapInitialCenter = initialCenterRef.current;
	if (mapMountReady && mapInitialCenter === null) {
		mapInitialCenter = positionForCenter
			? { lat: positionForCenter.lat, lng: positionForCenter.lng }
			: operatorDefaultCenter;
		initialCenterRef.current = mapInitialCenter;
	}

	return {
		mapMountReady,
		mapInitialCenter,
	};
}
