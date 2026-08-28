import { useEffect, type MutableRefObject } from "react";
import { Button } from "./Button";
import {
	table,
	zoomInIcon,
	zoomOutIcon,
	follow,
	myPosition,
	map3d,
	compass,
} from "../../../public/icons";
import colors from "../colors";
import type { IVehicleFilterResult } from "@shared/models/IVehiclePosition";
import { useDataContext } from "../context/DataContext";

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
	is3DViewEnabled: boolean;
	onToggle3DView: () => void;
	onResetMapHeading: () => void;
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
	is3DViewEnabled,
	onToggle3DView,
	onResetMapHeading,
}: MapControlButtonsProps) => {
	const { userPosition, tripData } = useDataContext();
	const canShowTripsButton =
		Boolean(userPosition) &&
		(filteredVehicles?.data.length > 0 ||
			tripData.upcomingTrips.length > 0 ||
			tripData.lineStops.length > 0);

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
				<div className="map-control-button-container">
					<p className="label table-label">Tabell</p>
					<Button
						title="Visa pågående resor"
						path={table.path}
						fill={showCurrentTrips ? colors.primary : colors.secondary}
						className={showCurrentTrips ? "--table --active" : "--table"}
						onClick={handleOnClick}
					/>
				</div>
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
			<div className="map-control-button-container">
				<p className="label map-3d-label">3D-vy</p>
				<Button
					aria-label={is3DViewEnabled ? "Stäng 3D-vy" : "Visa 3D-vy"}
					title={is3DViewEnabled ? "Stäng 3D-vy" : "Visa 3D-vy"}
					path={map3d.pathD}
					pathFillRule1={map3d.pathFillRuleD1}
					pathFillRule2={map3d.pathFillRuleD2}
					fill={is3DViewEnabled ? colors.primary : colors.secondary}
					className={is3DViewEnabled ? "--map-3d --active" : "--map-3d"}
					onClick={() => {
						if (mapReady) onToggle3DView();
					}}
				/>
			</div>
			<div className="map-control-button-container">
				<p className="label map-north-label sr-only">Norr</p>
				<Button
					aria-label="Rikta kartan mot norr"
					title="Rikta kartan mot norr"
					path={compass.pathD}
					pathFillRule1={compass.pathFillRuleD1}
					pathFillRule2={compass.pathFillRuleD2}
					fill={colors.secondary}
					className="--map-north"
					onClick={() => {
						if (mapReady) onResetMapHeading();
					}}
				/>
			</div>
		</div>
	);
};
