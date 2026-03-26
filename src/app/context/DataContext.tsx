"use client";
import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
	useEffect,
	useState,
} from "react";
import type { IDbData } from "@shared/models/IDbData";
import type { IShapes } from "@shared/models/IShapes";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type { IVehicleFilterResult } from "@shared/models/IVehiclePosition";
import { useGeolocation, type IUser } from "../hooks/useUserPosition";

export interface ITripData {
	currentTrips: IDbData[];
	upcomingTrips: IDbData[];
	lineStops: IDbData[];
	/** Distinct route shapes for trips on this line (from DB); used on the map when there are no live vehicles. */
	lineShapes: { shape_id: string; points: IShapes[] }[];
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
	isLoading: boolean;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
	isCurrentTripsOpen: boolean;
	setIsCurrentTripsOpen: Dispatch<SetStateAction<boolean>>;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: { data: [], error: undefined },
	setFilteredVehicles: () => {},
	tripData: { currentTrips: [], upcomingTrips: [], lineStops: [], lineShapes: [] },
	setTripData: () => {},
	filteredTripUpdates: [],
	setFilteredTripUpdates: () => {},
	userPosition: null,
	setUserPosition: () => {},
	isLoading: false,
	setIsLoading: () => {},
	isCurrentTripsOpen: false,
	setIsCurrentTripsOpen: () => {},
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
		lineStops: [],
		lineShapes: [],
	});
	const [filteredTripUpdates, setFilteredTripUpdates] = useState<ITripUpdate[]>(
		[],
	);
	const [userPosition, setUserPosition] = useState<IUser | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isCurrentTripsOpen, setIsCurrentTripsOpen] = useState(false);
	const geoPosition = useGeolocation(
		tripData.lineStops,
		tripData.currentTrips,
	);

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
				isLoading,
				setIsLoading,
				isCurrentTripsOpen,
				setIsCurrentTripsOpen,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
