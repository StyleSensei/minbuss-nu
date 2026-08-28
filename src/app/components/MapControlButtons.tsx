import type { IVehicleFilterResult } from "@shared/models/IVehiclePosition";
import { type MutableRefObject, useEffect } from "react";
import {
	follow,
	myPosition,
	table,
	zoomInIcon,
	zoomOutIcon,
} from "../../../public/icons";
import colors from "../colors";
import { useDataContext } from "../context/DataContext";
import { Button } from "./Button";

interface MapControlButtonsProps {
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	zoomIn: (GoogleMap: google.maps.Map) => void;
	zoomOut: (GoogleMap: google.maps.Map) => void;
	setShowCurrentTrips: (showCurrentTrips: boolean) => void;
	showCurrentTrips: boolean;
	filteredVehicles: IVehicleFilterResult;
	setFollowBus: (followBus: boolean) => void;
	followBus: boolean;
	activeMarker: boolean;
	mapReady: boolean;
	onMyPositionClick: () => void;
}

export const MapControlButtons = ({
	googleMapRef,
	zoomIn,
	zoomOut,
	setShowCurrentTrips,
	showCurrentTrips,
	filteredVehicles,
	setFollowBus,
	followBus,
	activeMarker,
	mapReady,
	onMyPositionClick,
}: MapControlButtonsProps) => {
	const { userPosition, tripData, selectedStopForSchedule } = useDataContext();
	const canShowTripsButton =
		selectedStopForSchedule !== null ||
		(Boolean(userPosition) &&
			(filteredVehicles?.data.length > 0 ||
				tripData.upcomingTrips.length > 0 ||
				tripData.lineStops.length > 0));

	useEffect(() => {
		const inputContainer = document.getElementById("searchbar");
		inputContainer?.addEventListener("focus", () => {
			setFollowBus(false);
		});
		return () => {
			inputContainer?.removeEventListener("focus", () => {
				setFollowBus(false);
			});
		};
	}, [setFollowBus]);

	const handleOnClick = () => {
		setShowCurrentTrips(!showCurrentTrips);
	};

	return (
		<div className="map-control-buttons">
			<div className="map-control-button-container">
				<div className="zoom-buttons">
					<p className="label zoom-label sr-only">Zoom</p>

					<Button
						className="--zoom"
						aria-label="Zooma in"
						title="Zooma in"
						path={zoomInIcon.pathD}
						pathFillRule1={zoomInIcon.pathFillRuleD1}
						pathFillRule2={zoomInIcon.pathFillRuleD2}
						fill={colors.secondary}
						onClick={() => {
							if (mapReady)
								googleMapRef.current ? zoomIn(googleMapRef.current) : null;
						}}
					/>
				</div>
				<div className="map-control-button-container">
					<Button
						className="--zoom"
						aria-label="Zooma ut"
						title="Zooma ut"
						path={zoomOutIcon.pathD}
						pathFillRule1={zoomOutIcon.pathFillRuleD1}
						pathFillRule2={zoomOutIcon.pathFillRuleD2}
						fill={colors.secondary}
						onClick={() => {
							if (mapReady)
								googleMapRef.current ? zoomOut(googleMapRef.current) : null;
						}}
					/>
				</div>
			</div>

			{canShowTripsButton && (
				<button
					type="button"
					className={`map-control-button-container${showCurrentTrips ? " --pressed" : ""}`}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={handleOnClick}
					aria-pressed={showCurrentTrips}
					title={showCurrentTrips ? "Dölj avgångstabell" : "Visa avgångstabell"}
				>
					<span className="label table-label">Tabell</span>
					<span
						className={`button --table${showCurrentTrips ? " --active" : ""}`}
						aria-hidden
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width={18}
							height={18}
							fill={showCurrentTrips ? colors.primary : colors.secondary}
							viewBox="0 0 16 16"
						>
							<title>Tabell</title>
							<path d={table.path} />
						</svg>
					</span>
				</button>
			)}
			{filteredVehicles?.data.length > 0 && activeMarker && (
				<div className="map-control-button-container">
					<p className="label follow-label">Följ</p>
					<Button
						title="Följ"
						pathFillRule1={follow.path}
						fill={followBus ? colors.primary : colors.secondary}
						className={followBus ? "--follow --active" : "--follow"}
						onClick={() => {
							setFollowBus(!followBus);
						}}
					/>
				</div>
			)}
			<div className="map-control-button-container">
				<p className="label my-position-label">Min position</p>
				<Button
					title="Zooma till min position"
					path={myPosition.pathD}
					viewBox={myPosition.viewBox}
					fill={colors.secondary}
					className={`--my-position ${!userPosition ? "--disabled" : ""}`}
					disabled={!userPosition}
					onClick={onMyPositionClick}
				/>
			</div>
		</div>
	);
};
