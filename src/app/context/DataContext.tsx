"use client";
import { createContext, useContext, useState } from "react";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";
import type { IDbData } from "../models/IDbData";

interface IDataContext {
	filteredVehicles: IVehiclePosition[];
	setFilteredVehicles: (vehicles: IVehiclePosition[]) => void;
	cachedDbDataState: IDbData[];
	setCachedDbDataState: (data: IDbData[]) => void;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: [],
	setFilteredVehicles: () => {},
	cachedDbDataState: [],
	setCachedDbDataState: () => {},
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
	return (
		<DataContext.Provider
			value={{
				filteredVehicles,
				setFilteredVehicles,
				cachedDbDataState,
				setCachedDbDataState,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
