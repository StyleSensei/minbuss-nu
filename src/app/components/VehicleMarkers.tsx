import type { IVehiclePosition } from "@/shared/models/IVehiclePosition";
import CustomMarker from "./CustomMarker";
import type { MutableRefObject } from "react";
import { useEffect } from "react";

interface IVehicleMarkersProps {
	vehicles: IVehiclePosition[];
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	clickedOutside: boolean;
	setClickedOutside: (value: boolean) => void;
	infoWindowActiveExternal: boolean;
	setInfoWindowActiveExternal: (value: boolean) => void;
	followBus: boolean;
	setFollowBus: (value: boolean) => void;
	activeMarkerId: string | null;
	setActiveMarkerId: (id: string | null) => void;
	showCurrentTrips: boolean;
}

const VehicleMarkers = ({ vehicles, ...props }: IVehicleMarkersProps) => {
	if (!vehicles || vehicles.length === 0) {
		return null;
	}
	return vehicles.map((vehicle) => (
		<CustomMarker
			{...props}
			currentVehicle={vehicle}
			key={vehicle.vehicle.id}
			position={{
				lat: vehicle.position.latitude,
				lng: vehicle.position.longitude,
			}}
			googleMapRef={props.googleMapRef}
			clickedOutside={props.clickedOutside}
			setClickedOutside={props.setClickedOutside}
			infoWindowActiveExternal={props.infoWindowActiveExternal}
			setInfoWindowActiveExternal={props.setInfoWindowActiveExternal}
			followBus={props.followBus}
			setFollowBus={props.setFollowBus}
			isActive={props.activeMarkerId === vehicle.vehicle.id}
			onActivateMarker={(id) => props.setActiveMarkerId(id)}
			showCurrentTrips={props.showCurrentTrips}
		/>
	));
};
export default VehicleMarkers;
