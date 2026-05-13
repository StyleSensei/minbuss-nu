import type { IDbData } from "@shared/models/IDbData";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import type { IUser } from "../../../hooks/useUserPosition";

function tripsAtStopSignature(trips: IDbData[]): string {
	return trips
		.map((t) => `${t.trip_id}:${t.stop_id}:${t.stop_sequence}`)
		.sort()
		.join("|");
}

export function useSyncTripsIntoUserPosition(
	userPosition: IUser | null,
	tripDataCurrentTrips: IDbData[],
	setUserPosition: Dispatch<SetStateAction<IUser | null>>,
	selectedStopForScheduleStopId: string | undefined,
	userClosestStopId: string | undefined,
) {
	const getTripsByStopId = useCallback(
		(array: IDbData[]) => {
			const stopId = selectedStopForScheduleStopId ?? userClosestStopId;
			if (!stopId) {
				return [];
			}
			return array.filter((item) => item.stop_id === stopId);
		},
		[selectedStopForScheduleStopId, userClosestStopId],
	);

	const tripsSig = useMemo(
		() => tripsAtStopSignature(getTripsByStopId(tripDataCurrentTrips)),
		[tripDataCurrentTrips, getTripsByStopId],
	);

	const storedSig = useMemo(
		() =>
			userPosition?.tripsAtClosestStop
				? tripsAtStopSignature(userPosition.tripsAtClosestStop)
				: "",
		[userPosition?.tripsAtClosestStop],
	);

	useEffect(() => {
		if (!userPosition) return;
		if (tripsSig === storedSig) return;

		const tripsAtClosestStop = getTripsByStopId(tripDataCurrentTrips);
		setUserPosition((prev) => {
			if (!prev) return null;
			return {
				...prev,
				tripsAtClosestStop,
			};
		});
	}, [
		tripDataCurrentTrips,
		getTripsByStopId,
		userPosition,
		setUserPosition,
		tripsSig,
		storedSig,
	]);
}
