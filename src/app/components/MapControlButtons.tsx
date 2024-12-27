import type { MutableRefObject } from "react";
import { Button } from "./Button";
import { table, zoomInIcon, zoomOutIcon } from "../../../public/icons";
import type { IVehiclePosition } from "../services/dataSources/gtfsRealtime";

interface MapControlButtonsProps {
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	zoomIn: (GoogleMap: google.maps.Map) => void;
	zoomOut: (GoogleMap: google.maps.Map) => void;
	setShowCurrentTrips: (showCurrentTrips: boolean) => void;
	showCurrentTrips: boolean;
	filteredVehicles: IVehiclePosition[];
}

export const MapControlButtons = ({
	googleMapRef,
	zoomIn,
	zoomOut,
	setShowCurrentTrips,
	showCurrentTrips,
	filteredVehicles,
}: MapControlButtonsProps) => {
	return (
		<div className="map-control-buttons">
			<div className="map-control-button-container">
				<Button
					className="--zoom"
					aria-label="Zooma in"
					title="Zooma in"
					path={zoomInIcon.pathD}
					pathFillRule1={zoomInIcon.pathFillRuleD1}
					pathFillRule2={zoomInIcon.pathFillRuleD2}
					fill="whitesmoke"
					onClick={() =>
						googleMapRef.current ? zoomIn(googleMapRef.current) : null
					}
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
					onClick={() =>
						googleMapRef.current ? zoomOut(googleMapRef.current) : null
					}
				/>
			</div>

			{filteredVehicles.length > 0 && (
				<div className="map-control-button-container">
					<Button
						title={
							showCurrentTrips ? "Dölj pågående resor" : "Visa pågående resor"
						}
						path={table.path}
						fill="whitesmoke"
						className="--table"
						onClick={() => setShowCurrentTrips(!showCurrentTrips)}
					/>
				</div>
			)}
		</div>
	);
};
