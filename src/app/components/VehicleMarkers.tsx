import type { MutableRefObject } from "react";
import { memo, useMemo } from "react";
import type { IDbData } from "@/shared/models/IDbData";
import type { IVehiclePosition } from "@/shared/models/IVehiclePosition";
import { useDataContext } from "../context/DataContext";
import CustomMarker from "./CustomMarker";

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

const VehicleMarkers = memo(function VehicleMarkers({
	vehicles,
	...props
}: IVehicleMarkersProps) {
	const { tripData } = useDataContext();
	const tripsByTripId = useMemo(() => {
		const byTripId = new Map<string, IDbData[]>();
		for (const trip of tripData.currentTrips) {
			if (!trip?.trip_id) continue;
			const existing = byTripId.get(trip.trip_id);
			if (existing) {
				existing.push(trip);
			} else {
				byTripId.set(trip.trip_id, [trip]);
			}
		}
		for (const trips of byTripId.values()) {
			trips.sort((a, b) => a.stop_sequence - b.stop_sequence);
		}
		return byTripId;
	}, [tripData.currentTrips]);

	const vehiclesWithShapes = useMemo(() => {
		if (!vehicles?.length) return vehicles;
		const shapeById = new Map(
			tripData.lineShapes.map((s) => [s.shape_id, s.points]),
		);
		return vehicles.map((v) => {
			if ((v.shapePoints?.length ?? 0) >= 2) return v;
			const tid = v.trip?.tripId ?? "";
			if (!tid) return v;
			const sid = tripsByTripId.get(tid)?.[0]?.shape_id;
			if (!sid) return v;
			const pts = shapeById.get(sid);
			if (!pts || pts.length < 2) return v;
			return { ...v, shapePoints: pts };
		});
	}, [vehicles, tripData.lineShapes, tripsByTripId]);

	if (!vehicles || vehicles.length === 0) {
		return null;
	}
	return vehiclesWithShapes.map((vehicle) => {
		const isActive = props.activeMarkerId === vehicle.vehicle.id;
		return (
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
				isActive={isActive}
				onActivateMarker={(id) => props.setActiveMarkerId(id)}
				showCurrentTrips={props.showCurrentTrips}
				tripsByTripId={tripsByTripId}
				zIndex={isActive ? 200 : 100}
			/>
		);
	});
});
export default VehicleMarkers;
