import { useEffect } from "react";

export function useSyncCurrentTripsOpenToContext(
	showCurrentTrips: boolean,
	setIsCurrentTripsOpen: (v: boolean) => void,
) {
	useEffect(() => {
		setIsCurrentTripsOpen(showCurrentTrips);
		return () => setIsCurrentTripsOpen(false);
	}, [showCurrentTrips, setIsCurrentTripsOpen]);
}
