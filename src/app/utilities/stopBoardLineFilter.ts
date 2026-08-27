import type { IDbData } from "@shared/models/IDbData";
import type { IStopBoardShape } from "@shared/models/IStopBoardShape";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";

export interface IFilteredStopBoard {
	departures: IDbData[];
	tripIds: Set<string>;
	vehicles: IVehiclePosition[];
}

const normalizeLine = (line: string) => line.trim().toUpperCase();

export function filterStopBoardByLines(
	departures: IDbData[],
	vehicles: IVehiclePosition[],
	selectedLines: string[] | null,
	selectedPlatformStopId: string | null = null,
	selectedRouteType: number | null = null,
): IFilteredStopBoard {
	const selected =
		selectedLines === null
			? null
			: new Set(selectedLines.map(normalizeLine).filter(Boolean));
	const filteredDepartures = departures.filter((departure) => {
		if (
			selectedPlatformStopId !== null &&
			departure.stop_id !== selectedPlatformStopId
		) {
			return false;
		}
		if (
			selectedRouteType !== null &&
			departure.route_type !== selectedRouteType
		) {
			return false;
		}
		return (
			selected === null ||
			selected.has(normalizeLine(departure.route_short_name))
		);
	});
	const tripIds = new Set(
		filteredDepartures
			.map((departure) => departure.trip_id)
			.filter((tripId): tripId is string => Boolean(tripId)),
	);
	const seenVehicleIds = new Set<string>();
	const filteredVehicles = vehicles.filter((vehicle) => {
		const tripId = vehicle.trip?.tripId;
		const vehicleId = vehicle.vehicle?.id;
		if (!tripId || !vehicleId || !tripIds.has(tripId)) return false;
		if (seenVehicleIds.has(vehicleId)) return false;
		seenVehicleIds.add(vehicleId);
		return true;
	});

	return {
		departures: filteredDepartures,
		tripIds,
		vehicles: filteredVehicles,
	};
}

export function toggleStopBoardLine(
	current: string[] | null,
	line: string,
	availableLines: string[],
): string[] | null {
	const normalizedLine = normalizeLine(line);
	const available = availableLines.map(normalizeLine).filter(Boolean);
	if (!available.includes(normalizedLine)) return current;

	const selected = current?.map(normalizeLine) ?? [];
	if (selected.length === 1 && selected[0] === normalizedLine) {
		return null;
	}
	return [normalizedLine];
}

export function filterStopBoardShapes(
	shapes: IStopBoardShape[],
	selectedLines: string[] | null,
	selectedRouteType: number | null = null,
): IStopBoardShape[] {
	const selected =
		selectedLines === null
			? null
			: new Set(selectedLines.map(normalizeLine).filter(Boolean));
	const seenShapeIds = new Set<string>();
	return shapes.filter((shape) => {
		if (selectedRouteType !== null && shape.route_type !== selectedRouteType) {
			return false;
		}
		if (
			selected !== null &&
			!selected.has(normalizeLine(shape.route_short_name))
		) {
			return false;
		}
		if (!shape.shape_id || seenShapeIds.has(shape.shape_id)) return false;
		seenShapeIds.add(shape.shape_id);
		return true;
	});
}
