import type { IDbData } from "@shared/models/IDbData";
import { useEffect } from "react";

export function useAutoOpenCurrentTrips(
	selectedStopForSchedule: IDbData | null,
	setShowCurrentTrips: (v: boolean) => void,
) {
	useEffect(() => {
		if (!selectedStopForSchedule) return;
		setShowCurrentTrips(true);
	}, [selectedStopForSchedule, setShowCurrentTrips]);
}
