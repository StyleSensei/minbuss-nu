"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { busStop } from "public/icons";
import colors from "../colors";
import { Icon } from "../components/Icon";
import type { IStopPositionJson } from "./stopPositionsTypes";

type Props = {
	stops: IStopPositionJson[];
	onStopClick: (stop: IStopPositionJson) => void;
	mapRef: React.RefObject<google.maps.Map>;
	stopMarkersVisible: boolean;
	/** Full storlek + buss-ikon; false = liten prick utan ikon (inaktiv stil). */
	detailMode: boolean;
	/** Gul markör när vald hållplats (endast i detailMode). */
	activeStopId?: string | null;
};

export function StopMarkersLayer({
	stops,
	onStopClick,
	mapRef: _mapRef,
	stopMarkersVisible,
	detailMode,
	activeStopId,
}: Props) {
	return (
		<>
			{stops.map((s) => {
				const isActive = Boolean(
					detailMode && activeStopId && s.id === activeStopId,
				);
				return (
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
							<div
								className={`stop-marker-hit${isActive ? " stop-marker-hit--active" : ""}${detailMode ? "" : " stop-marker-hit--compact"}`}
							>
								{detailMode ? (
									<Icon
										title="Hållplats"
										path={busStop.pathD}
										viewBox={busStop.viewBox}
										fill={isActive ? colors.primary : colors.secondary}
										iconSize="24px"
										className="stop-marker-hit__icon"
									/>
								) : null}
							</div>
						</div>
					</AdvancedMarker>
				);
			})}
		</>
	);
}
