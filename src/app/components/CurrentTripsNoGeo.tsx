import type { IDbData } from "../models/IDbData";
import { useOverflow } from "../hooks/useOverflow";

interface ICurrentTripsProps {
	lastStops: IDbData[];
}

export const CurrentTripsNoGeo = ({ lastStops }: ICurrentTripsProps) => {
	const { containerRef, isOverflowing } = useOverflow();

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
						<th>Mot</th>
						<th>Ankomsttid</th>
					</tr>
				</thead>
				<tbody>
					{lastStops.map((stop) => (
						<tr key={stop?.trip_id}>
							<td>{stop?.stop_headsign}</td>
							<td>{stop?.arrival_time?.slice(0, 5)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
