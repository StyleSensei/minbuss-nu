"use client";
import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
	useEffect,
	useMemo,
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

export interface IMapStopPreview {
	stop: IDbData;
	routeShortNames: string[];
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
	selectedStopForSchedule: IDbData | null;
	setSelectedStopForSchedule: Dispatch<SetStateAction<IDbData | null>>;
	selectedStopRouteLines: string[] | null;
	setSelectedStopRouteLines: Dispatch<SetStateAction<string[] | null>>;
	/**
	 * Hållplats längs vald fordons tur (samma som InfoWindow / findClosestOrNextStop).
	 * Används av CurrentTrips så avgångslistan följer bussens läge, inte bara användarens närmaste hållplats.
	 */
	activeVehicleBoardStop: IDbData | null;
	setActiveVehicleBoardStop: (stop: IDbData | null) => void;
	activeFollowedTripId: string | null;
	setActiveFollowedTripId: (tripId: string | null) => void;
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
	selectedStopRouteLines: null,
	setSelectedStopRouteLines: () => {},
	activeVehicleBoardStop: null,
	setActiveVehicleBoardStop: () => {},
	activeFollowedTripId: null,
	setActiveFollowedTripId: () => {},
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
	const [selectedStopRouteLines, setSelectedStopRouteLines] = useState<
		string[] | null
	>(null);
	const [activeVehicleBoardStop, setActiveVehicleBoardStop] =
		useState<IDbData | null>(null);
	const [activeFollowedTripId, setActiveFollowedTripId] = useState<string | null>(
		null,
	);
	const geoPosition = useGeolocation(tripData.lineStops, tripData.currentTrips);

	useEffect(() => {
		if (geoPosition) {
			setUserPosition(geoPosition);
		}
	}, [geoPosition]);

	const contextValue = useMemo(
		() => ({
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
			selectedStopRouteLines,
			setSelectedStopRouteLines,
			activeVehicleBoardStop,
			setActiveVehicleBoardStop,
			activeFollowedTripId,
			setActiveFollowedTripId,
		}),
		[
			filteredVehicles,
			tripData,
			filteredTripUpdates,
			userPosition,
			isLoading,
			isCurrentTripsOpen,
			mapStopPreview,
			selectedStopForSchedule,
			selectedStopRouteLines,
			activeVehicleBoardStop,
			activeFollowedTripId,
		],
	);

	return (
		<DataContext.Provider value={contextValue}>{children}</DataContext.Provider>
	);
};
