import { useEffect, type MutableRefObject } from "react";
import { Button } from "./Button";
import { table, zoomInIcon, zoomOutIcon, follow } from "../../../public/icons";
import colors from "../colors.module.scss";
import useUserPosition from "../hooks/useUserPosition";
import type { IVehicleFilterResult } from "../actions/filterVehicles";

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
}: MapControlButtonsProps) => {
	const { userPosition } = useUserPosition();

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
						fill="whitesmoke"
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
						fill="whitesmoke"
						onClick={() => {
							if (mapReady)
								googleMapRef.current ? zoomOut(googleMapRef.current) : null;
						}}
					/>
				</div>
			</div>

			{filteredVehicles?.data.length > 0 && userPosition && (
				<div className="map-control-button-container">
					<p className="label table-label">Tabell</p>
					<Button
						title="Visa pågående resor"
						path={table.path}
						fill={
							showCurrentTrips ? colors.primaryColor : colors.secondaryColor
						}
						className={showCurrentTrips ? "--table --active" : "--table"}
						onClick={handleOnClick}
					/>
				</div>
			)}
			{filteredVehicles?.data.length > 0 && activeMarker && (
				<div className="map-control-button-container">
					<p className="label follow-label">Följ buss</p>
					<Button
						title="Följ buss"
						pathFillRule1={follow.path}
						fill={followBus ? colors.primaryColor : colors.secondaryColor}
						className={followBus ? "--follow --active" : "--follow"}
						onClick={() => {
							setFollowBus(!followBus);
						}}
					/>
				</div>
			)}
		</div>
	);
};
