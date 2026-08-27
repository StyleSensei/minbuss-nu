import type { IDbData } from "@shared/models/IDbData";
import { useEffect } from "react";

export function useAutoOpenCurrentTrips(
	selectedStopForSchedule: IDbData | null,
	setShowCurrentTrips: (v: boolean) => void,
) {
	const pinnedStopId = selectedStopForSchedule?.stop_id ?? null;

	useEffect(() => {
		if (!pinnedStopId) return;
		setShowCurrentTrips(true);
	}, [pinnedStopId, setShowCurrentTrips]);
}
