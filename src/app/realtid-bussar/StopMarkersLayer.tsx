"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { busStop, subwayStop } from "public/icons";
import { memo } from "react";
import colors from "../colors";
import { Icon } from "../components/Icon";
import { isStopMarkerActive } from "./mapClient/mapClientStopUi";
import type { IStopPositionJson } from "./stopPositionsTypes";

type Props = {
	stops: IStopPositionJson[];
	onStopClick: (stop: IStopPositionJson) => void;
	mapRef: React.RefObject<google.maps.Map | null>;
	stopMarkersVisible: boolean;
	/** Full storlek + buss-ikon; false = liten prick utan ikon (inaktiv stil). */
	detailMode: boolean;
	/** Visa hållplatsnamn i samma container som ikonen. */
	labelMode: boolean;
	/** Senast klickad hållplats (parent eller child). */
	activeStopId?: string | null;
	/** Parent-id:n för den öppna stationsgruppen — alla relaterade markörer blir aktiva. */
	focusedStationIds?: readonly string[];
};

export const StopMarkersLayer = memo(function StopMarkersLayer({
	stops,
	onStopClick,
	mapRef: _mapRef,
	stopMarkersVisible,
	detailMode,
	labelMode,
	activeStopId,
	focusedStationIds = [],
}: Props) {
	const focusedParentIds = new Set(focusedStationIds);
	return (
		<>
			{stops.map((s) => {
				const isPlatformLabel = s.presentation === "platform-label";
				const isGroupStop = s.presentation === "group-stop";
				const stopIcon = s.locationType === 2 ? subwayStop : busStop;
				const stopIconTitle =
					s.locationType === 2 ? "Tunnelbanestation" : "Hållplats";
				const isActive = isStopMarkerActive(
					s,
					activeStopId,
					focusedParentIds,
					detailMode,
				);
				const showIcon = !isPlatformLabel && (detailMode || isGroupStop);
				const showLabel =
					isPlatformLabel || isGroupStop || (labelMode && Boolean(s.name));
				const label = isPlatformLabel
					? `Läge ${s.platformCode}`
					: s.platformCode
						? `${s.name} · Läge ${s.platformCode}`
						: s.name;
				return (
					<AdvancedMarker
						key={s.id}
						position={new google.maps.LatLng({ lat: s.lat, lng: s.lon })}
						title={label || s.id}
						zIndex={isPlatformLabel ? 1 : isActive ? 3 : isGroupStop ? 2 : 1}
						clickable={!isPlatformLabel}
						onClick={
							isPlatformLabel
								? undefined
								: (ev) => {
										ev.stop?.();
										onStopClick(s);
									}
						}
					>
						<div
							className={`stop-marker-visibility-wrap ${stopMarkersVisible ? "--visible" : ""}${showLabel ? " stop-marker-visibility-wrap--labeled" : ""}${isPlatformLabel ? " stop-marker-visibility-wrap--passive" : ""}`}
						>
							<div
								className={`stop-marker-hit${isActive ? " stop-marker-hit--active" : ""}${showIcon ? "" : isPlatformLabel ? "" : " stop-marker-hit--compact"}${showLabel ? " stop-marker-hit--labeled" : ""}${isPlatformLabel ? " stop-marker-hit--platform-label" : ""}`}
							>
								{showIcon ? (
									<Icon
										title={stopIconTitle}
										path={stopIcon.pathD}
										viewBox={stopIcon.viewBox}
										fill={isActive ? colors.primary : colors.secondary}
										iconSize="24px"
										className="stop-marker-hit__icon"
									/>
								) : null}
								{showLabel ? (
									<span
										className={`stop-marker-label${isPlatformLabel ? " stop-marker-label--platform" : ""}`}
									>
										{label}
									</span>
								) : null}
							</div>
						</div>
					</AdvancedMarker>
				);
			})}
		</>
	);
});
