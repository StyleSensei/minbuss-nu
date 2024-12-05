"use client";
import { createContext, useContext, useState } from "react";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";

interface IFilterContext {
	filteredVehicles: IVehiclePosition[];
	setFilteredVehicles: (vehicles: IVehiclePosition[]) => void;
}
const FilterContext = createContext<IFilterContext>({
	filteredVehicles: [],
	setFilteredVehicles: () => {},
});

export const useFilterContext = () => useContext(FilterContext);

export const FilterProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [filteredVehicles, setFilteredVehicles] = useState<IVehiclePosition[]>(
		[],
	);
	return (
		<FilterContext.Provider value={{ filteredVehicles, setFilteredVehicles }}>
			{children}
		</FilterContext.Provider>
	);
};
