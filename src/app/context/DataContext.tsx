"use client";
import { createContext, useContext, useState } from "react";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import type { IDbData } from "../models/IDbData";
import type { ITripUpdate } from "../models/ITripUpdate";

interface IDataContext {
	filteredVehicles: IVehiclePosition[];
	setFilteredVehicles: (vehicles: IVehiclePosition[]) => void;
	cachedDbDataState: IDbData[];
	setCachedDbDataState: (data: IDbData[]) => void;
	filteredTripUpdates: ITripUpdate[];
	setFilteredTripUpdates: (trips: ITripUpdate[]) => void;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: [],
	setFilteredVehicles: () => {},
	cachedDbDataState: [],
	setCachedDbDataState: () => {},
	filteredTripUpdates: [],
	setFilteredTripUpdates: () => {},
});

export const useDataContext = () => useContext(DataContext);

export const DataProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [filteredVehicles, setFilteredVehicles] = useState<IVehiclePosition[]>(
		[],
	);
	const [cachedDbDataState, setCachedDbDataState] = useState<IDbData[]>([]);
	const [filteredTripUpdates, setFilteredTripUpdates] = useState<ITripUpdate[]>(
		[],
	);
	return (
		<DataContext.Provider
			value={{
				filteredVehicles,
				setFilteredVehicles,
				cachedDbDataState,
				setCachedDbDataState,
				filteredTripUpdates,
				setFilteredTripUpdates,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
