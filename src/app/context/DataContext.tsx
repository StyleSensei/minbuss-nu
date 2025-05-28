"use client";
import { createContext, useContext, useState } from "react";
import type { IDbData } from "@shared/models/IDbData";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type { IVehicleFilterResult } from "../actions/filterVehicles";

interface IDataContext {
	filteredVehicles: IVehicleFilterResult;
	setFilteredVehicles: (vehicles: IVehicleFilterResult) => void;
	cachedDbDataState: IDbData[];
	setCachedDbDataState: (data: IDbData[]) => void;
	filteredTripUpdates: ITripUpdate[];
	setFilteredTripUpdates: (trips: ITripUpdate[]) => void;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: { data: [], error: undefined },
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
	const [filteredVehicles, setFilteredVehicles] =
		useState<IVehicleFilterResult>({ data: [], error: undefined });
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
