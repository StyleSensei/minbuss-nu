import type { IDbData } from "../models/IDbData";

interface ICurrentTripsProps {
	lastStops: IDbData[];
}

export const CurrentTrips = ({ lastStops }: ICurrentTripsProps) => {
	return (
		<div className="table-container" aria-live="polite">
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
							<td>{stop?.arrival_time.slice(0, 5)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
