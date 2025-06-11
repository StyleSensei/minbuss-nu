"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { IDbData } from "@shared/models/IDbData";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type { IVehicleFilterResult } from "../actions/filterVehicles";
import { useGeolocation, type IUser } from "../hooks/useUserPosition";

export interface ITripData {
	currentTrips: IDbData[];
	upcomingTrips: IDbData[];
}
interface IDataContext {
	filteredVehicles: IVehicleFilterResult;
	setFilteredVehicles: (vehicles: IVehicleFilterResult) => void;
	tripData: ITripData;
	setTripData: (data: ITripData | ((prev: ITripData) => ITripData)) => void;
	filteredTripUpdates: ITripUpdate[];
	setFilteredTripUpdates: (trips: ITripUpdate[]) => void;
	userPosition: IUser | null;
	setUserPosition: (
		position: IUser | null | ((prev: IUser | null) => IUser | null),
	) => void;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: { data: [], error: undefined },
	setFilteredVehicles: () => {},
	tripData: { currentTrips: [], upcomingTrips: [] },
	setTripData: () => {},
	filteredTripUpdates: [],
	setFilteredTripUpdates: () => {},
	userPosition: null,
	setUserPosition: () => {},
});

export const useDataContext = () => useContext(DataContext);

export const DataProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [filteredVehicles, setFilteredVehicles] =
		useState<IVehicleFilterResult>({ data: [], error: undefined });
	const [tripData, setTripData] = useState<ITripData>({
		currentTrips: [],
		upcomingTrips: [],
	});
	const [filteredTripUpdates, setFilteredTripUpdates] = useState<ITripUpdate[]>(
		[],
	);
	const [userPosition, setUserPosition] = useState<IUser | null>(null);
	const geoPosition = useGeolocation(tripData.currentTrips);

	useEffect(() => {
		if (geoPosition) {
			setUserPosition(geoPosition);
		}
	}, [geoPosition]);

	return (
		<DataContext.Provider
			value={{
				filteredVehicles,
				setFilteredVehicles,
				tripData,
				setTripData,
				filteredTripUpdates,
				setFilteredTripUpdates,
				userPosition,
				setUserPosition,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
