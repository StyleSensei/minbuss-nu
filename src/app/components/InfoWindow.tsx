"use client";

import { useOverflow } from "../hooks/useOverflow";
import type { IDbData } from "../models/IDbData";

interface IInfoWindowProps {
	closestStopState: IDbData | null;
}

export const InfoWindow = ({ closestStopState }: IInfoWindowProps) => {
	const { containerRef, isOverflowing } = useOverflow();

	return (
		<div
			className={`info-window ${isOverflowing ? "--overflowing" : ""}`}
			aria-live="polite"
			ref={containerRef}
		>
			<h2>
				<span className="bus-line">{closestStopState?.route_short_name}, </span>
				<span id="final-station">{closestStopState?.stop_headsign}</span>
			</h2>
			<h2 className="next-stop">Nästa stopp: </h2>
			<p className="next-stop">{closestStopState?.stop_name}</p>
			<h2>Ankomst:</h2>
			<p>{closestStopState?.arrival_time.slice(0, 5)}</p>
		</div>
	);
};
