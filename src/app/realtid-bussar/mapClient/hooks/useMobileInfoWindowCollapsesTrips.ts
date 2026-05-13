import { useEffect } from "react";

export function useMobileInfoWindowCollapsesTrips(
	isMobile: boolean,
	infoWindowActive: boolean,
	setShowCurrentTrips: (v: boolean) => void,
) {
	useEffect(() => {
		if (isMobile && infoWindowActive) {
			setShowCurrentTrips(false);
		}
	}, [isMobile, infoWindowActive, setShowCurrentTrips]);
}
