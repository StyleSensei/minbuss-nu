import type { ICalendarDates } from "../../shared/models/ICalendarDates";
import type { IRoute } from "../../shared/models/IRoute";
import type { IShapes } from "../../shared/models/IShapes";
import type { IStop } from "../../shared/models/IStop";
import type { IStopTime } from "../../shared/models/IStopTime";
import type { ITrip } from "../../shared/models/ITrip";

type CsvRow = Record<string, string>;

export const transformRoutes = (rows: CsvRow[], operator: string): IRoute[] =>
	rows.map(
		(route) =>
			({
				...route,
				operator,
				route_type: Number(route.route_type),
			}) as IRoute,
	);

export const transformTrips = (rows: CsvRow[], operator: string): ITrip[] =>
	rows.map(
		(trip) =>
			({
				...trip,
				operator,
				service_id: Number(trip.service_id),
				direction_id: Number(trip.direction_id),
			}) as ITrip,
	);

export const transformStops = (rows: CsvRow[], operator: string): IStop[] =>
	rows.map(
		(stop) =>
			({
				...stop,
				operator,
				stop_lat: Number(stop.stop_lat),
				stop_lon: Number(stop.stop_lon),
				location_type: Number(stop.location_type),
			}) as IStop,
	);

export const transformStopTimes = (
	rows: CsvRow[],
	operator: string,
): IStopTime[] =>
	rows.map(
		(stopTime) =>
			({
				...stopTime,
				operator,
				stop_sequence: Number(stopTime.stop_sequence),
				pickup_type: Number(stopTime.pickup_type),
				drop_off_type: Number(stopTime.drop_off_type),
				shape_dist_traveled:
					stopTime.shape_dist_traveled === ""
						? "0"
						: String(stopTime.shape_dist_traveled),
				timepoint: Number(stopTime.timepoint),
			}) as IStopTime,
	);

export const transformCalendarDates = (
	rows: CsvRow[],
	operator: string,
): ICalendarDates[] =>
	rows.map(
		(date) =>
			({
				...date,
				operator,
				service_id: Number(date.service_id),
				exception_type: Number(date.exception_type),
			}) as ICalendarDates,
	);

export const transformShapes = (rows: CsvRow[], operator: string): IShapes[] =>
	rows.map((shape) => {
		const rawDist = shape.shape_dist_traveled;
		const distMissing =
			rawDist === "" ||
			rawDist === null ||
			rawDist === undefined ||
			rawDist.trim() === "";
		const distNum = distMissing ? Number.NaN : Number(rawDist);
		const shape_dist_traveled =
			distMissing || Number.isNaN(distNum) ? undefined : distNum;

		return {
			...shape,
			operator,
			shape_pt_lat: Number(shape.shape_pt_lat),
			shape_pt_lon: Number(shape.shape_pt_lon),
			shape_pt_sequence: Number(shape.shape_pt_sequence),
			shape_dist_traveled,
		} as IShapes;
	});
