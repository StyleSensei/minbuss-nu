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

/** Preview marker on map when user picks a stop from search; includes lines serving that stop. */
export interface IMapStopPreview {
	stop: IDbData;
	routeShortNames: string[];
	/** Set while fetching `/api/stops/.../routes` after clicking a map stop marker. */
	routesLoading?: boolean;
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
	mapStopPreview: IMapStopPreview | null;
	setMapStopPreview: Dispatch<SetStateAction<IMapStopPreview | null>>;
	/** When set, upcoming trips use this stop instead of GPS closest stop (e.g. after choosing a line from map preview). */
	selectedStopForSchedule: IDbData | null;
	setSelectedStopForSchedule: Dispatch<SetStateAction<IDbData | null>>;
}
const DataContext = createContext<IDataContext>({
	filteredVehicles: { data: [], error: undefined },
	setFilteredVehicles: () => {},
	tripData: {
		currentTrips: [],
		upcomingTrips: [],
		lineStops: [],
		lineShapes: [],
	},
	setTripData: () => {},
	filteredTripUpdates: [],
	setFilteredTripUpdates: () => {},
	userPosition: null,
	setUserPosition: () => {},
	isLoading: false,
	setIsLoading: () => {},
	isCurrentTripsOpen: false,
	setIsCurrentTripsOpen: () => {},
	mapStopPreview: null,
	setMapStopPreview: () => {},
	selectedStopForSchedule: null,
	setSelectedStopForSchedule: () => {},
});

export const useDataContext = () => useContext(DataContext);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
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
	const [mapStopPreview, setMapStopPreview] = useState<IMapStopPreview | null>(
		null,
	);
	const [selectedStopForSchedule, setSelectedStopForSchedule] =
		useState<IDbData | null>(null);
	const geoPosition = useGeolocation(tripData.lineStops, tripData.currentTrips);

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
				mapStopPreview,
				setMapStopPreview,
				selectedStopForSchedule,
				setSelectedStopForSchedule,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
