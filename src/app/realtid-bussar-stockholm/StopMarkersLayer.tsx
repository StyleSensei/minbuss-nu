"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import type { IStopPositionJson } from "./stopPositionsTypes";
import { busStop } from "public/icons";
import { Icon } from "../components/Icon";

type Props = {
	stops: IStopPositionJson[];
	onStopClick: (stop: IStopPositionJson) => void;
	mapRef: React.RefObject<google.maps.Map>;
	stopMarkersVisible: boolean;
};

export function StopMarkersLayer({
	stops,
	onStopClick,
	mapRef: _mapRef,
	stopMarkersVisible,
}: Props) {
	return (
		<>
			{stops.map((s) => (
				<AdvancedMarker
					key={s.id}
					position={new google.maps.LatLng({ lat: s.lat, lng: s.lon })}
					title={s.id}
					clickable
						onClick={(ev) => {
							ev.stop?.();
							onStopClick(s);
						}}
				>
					<div
						className={`stop-marker-visibility-wrap ${stopMarkersVisible ? "--visible" : ""}`}
					>
						<Icon
							title="Hållplats"
							path={busStop.pathD}
							viewBox={busStop.viewBox}
							fill="black"
							iconSize="24px"
							className="stop-marker-dot"
						/>
					</div>
				</AdvancedMarker>
			))}
		</>
	);
}
