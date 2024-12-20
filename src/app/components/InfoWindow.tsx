"use client";

import type { IDbData } from "../models/IDbData";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
}

export const InfoWindow = ({ closestStopState }: IInfoWindowProps) => {
	return (
		<div className="info-window">
			<h2>
				<span className="bus-line">{closestStopState?.route_short_name}, </span>
				<span id="final-station">{closestStopState?.stop_headsign}</span>
			</h2>
			<h2 className="next-stop">Nästa stop: </h2>
			<p className="next-stop">{closestStopState?.stop_name}</p>
			<h2>Ankomsttid:</h2>
			<p>{closestStopState?.arrival_time}</p>
		</div>
	);
};
