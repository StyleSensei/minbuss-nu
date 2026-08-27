"use client";
import type { IDbData } from "@shared/models/IDbData";
import type { IShapes } from "@shared/models/IShapes";
import type { IStopBoardChild } from "@shared/models/IStopBoardStation";
import type { ITripUpdate } from "@shared/models/ITripUpdate";
import type {
	IVehicleFilterResult,
	IVehiclePosition,
} from "@shared/models/IVehiclePosition";
import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
	useMemo,
	useState,
} from "react";
import { type IUser, useGeolocation } from "../hooks/useUserPosition";

export interface ITripData {
	currentTrips: IDbData[];
	upcomingTrips: IDbData[];
	lineStops: IDbData[];
	/** Distinct route shapes for trips on this line (from DB); used on the map when there are no live vehicles. */
	lineShapes: { shape_id: string; points: IShapes[] }[];
}

export interface IStopBoardData {
	stationStopId: string | null;
	stationStopIds: string[];
	children: IStopBoardChild[];
	departures: IDbData[];
	tripUpdates: ITripUpdate[];
	activeTripIds: string[];
	vehicles: IVehiclePosition[];
	routes: string[];
	isLoading: boolean;
	error: string | null;
}

export const EMPTY_STOP_BOARD_DATA: IStopBoardData = {
	stationStopId: null,
	stationStopIds: [],
	children: [],
	departures: [],
	tripUpdates: [],
	activeTripIds: [],
	vehicles: [],
	routes: [],
	isLoading: false,
	error: null,
};

interface IDataContext {
	filteredVehicles: IVehicleFilterResult;
	setFilteredVehicles: (vehicles: IVehicleFilterResult) => void;
	tripData: ITripData;
	setTripData: (data: ITripData | ((prev: ITripData) => ITripData)) => void;
	filteredTripUpdates: ITripUpdate[];
	setFilteredTripUpdates: (trips: ITripUpdate[]) => void;
	userPosition: IUser | null;
	setUserPosition: Dispatch<SetStateAction<IUser | null>>;
	isLoading: boolean;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
	isCurrentTripsOpen: boolean;
	setIsCurrentTripsOpen: Dispatch<SetStateAction<boolean>>;
	selectedStopForSchedule: IDbData | null;
	setSelectedStopForSchedule: Dispatch<SetStateAction<IDbData | null>>;
	selectedStopRouteLines: string[] | null;
	setSelectedStopRouteLines: Dispatch<SetStateAction<string[] | null>>;
	stopBoardData: IStopBoardData;
	setStopBoardData: Dispatch<SetStateAction<IStopBoardData>>;
	selectedStopLineFilter: string[] | null;
	setSelectedStopLineFilter: Dispatch<SetStateAction<string[] | null>>;
	selectedStopPlatformFilter: string | null;
	setSelectedStopPlatformFilter: Dispatch<SetStateAction<string | null>>;
	selectedStopModeFilter: number | null;
	setSelectedStopModeFilter: Dispatch<SetStateAction<number | null>>;
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
	selectedStopForSchedule: null,
	setSelectedStopForSchedule: () => {},
	selectedStopRouteLines: null,
	setSelectedStopRouteLines: () => {},
	stopBoardData: EMPTY_STOP_BOARD_DATA,
	setStopBoardData: () => {},
	selectedStopLineFilter: null,
	setSelectedStopLineFilter: () => {},
	selectedStopPlatformFilter: null,
	setSelectedStopPlatformFilter: () => {},
	selectedStopModeFilter: null,
	setSelectedStopModeFilter: () => {},
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
	const [isLoading, setIsLoading] = useState(false);
	const [isCurrentTripsOpen, setIsCurrentTripsOpen] = useState(false);
	const [selectedStopForSchedule, setSelectedStopForSchedule] =
		useState<IDbData | null>(null);
	const [selectedStopRouteLines, setSelectedStopRouteLines] = useState<
		string[] | null
	>(null);
	const [stopBoardData, setStopBoardData] = useState<IStopBoardData>(
		EMPTY_STOP_BOARD_DATA,
	);
	const [selectedStopLineFilter, setSelectedStopLineFilter] = useState<
		string[] | null
	>(null);
	const [selectedStopPlatformFilter, setSelectedStopPlatformFilter] = useState<
		string | null
	>(null);
	const [selectedStopModeFilter, setSelectedStopModeFilter] = useState<
		number | null
	>(null);
	const [activeVehicleBoardStop, setActiveVehicleBoardStop] =
		useState<IDbData | null>(null);
	const [activeFollowedTripId, setActiveFollowedTripId] = useState<
		string | null
	>(null);
	const [userPosition, setUserPosition] = useGeolocation(
		tripData.lineStops,
		tripData.currentTrips,
	);

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
			selectedStopForSchedule,
			setSelectedStopForSchedule,
			selectedStopRouteLines,
			setSelectedStopRouteLines,
			stopBoardData,
			setStopBoardData,
			selectedStopLineFilter,
			setSelectedStopLineFilter,
			selectedStopPlatformFilter,
			setSelectedStopPlatformFilter,
			selectedStopModeFilter,
			setSelectedStopModeFilter,
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
			setUserPosition,
			isLoading,
			isCurrentTripsOpen,
			selectedStopForSchedule,
			selectedStopRouteLines,
			stopBoardData,
			selectedStopLineFilter,
			selectedStopPlatformFilter,
			selectedStopModeFilter,
			activeVehicleBoardStop,
			activeFollowedTripId,
		],
	);

	return (
		<DataContext.Provider value={contextValue}>{children}</DataContext.Provider>
	);
};
