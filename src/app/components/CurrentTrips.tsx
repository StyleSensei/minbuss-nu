import { useCallback, useEffect, useRef, useState } from "react";
import type { IDbData } from "../models/IDbData";
import { check } from "drizzle-orm/mysql-core";
import { useOverflow } from "../hooks/useOverflow";

interface ICurrentTripsProps {
	lastStops: IDbData[];
}

export const CurrentTrips = ({ lastStops }: ICurrentTripsProps) => {
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
