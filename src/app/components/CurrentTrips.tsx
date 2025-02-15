import type { IDbData } from "../models/IDbData";
import { useOverflow } from "../hooks/useOverflow";
import useUserPosition from "../hooks/useUserPosition";

interface ICurrentTripsProps {
	lastStops: IDbData[];
}

export const CurrentTrips = ({ lastStops }: ICurrentTripsProps) => {
	const { containerRef, isOverflowing } = useOverflow();

	const { userPosition } = useUserPosition();

	return (
		<div
			className={`table-container ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			<table>
				<caption>Pågående resor</caption>
				<thead>
					<tr>
						<th>Linje</th>
						<th>Destination</th>
						<th>Ankomsttid</th>
					</tr>
				</thead>
				<tbody>
					{lastStops.map((stop) => (
						<tr key={stop?.trip_id}>
							<td>{stop?.route_short_name}</td>
							<td>{stop?.stop_headsign}</td>
							<td>{stop?.arrival_time?.slice(0, 5)}</td>
						</tr>
					))}
				</tbody>
			</table>
			{userPosition?.tripsAtClosestStop.length && (
				<table>
					<caption>Ankommer närmsta hållplats</caption>
					<thead>
						<tr>
							<th>Linje</th>
							<th>Hållplats</th>
							<th>Ankomsttid</th>
						</tr>
					</thead>
					<tbody>
						{userPosition?.tripsAtClosestStop.map((trip) => (
							<tr key={trip?.trip_id}>
								<td>{trip?.route_short_name}</td>
								<td>{trip?.stop_name}</td>
								<td>{trip?.arrival_time?.slice(0, 5)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
};
