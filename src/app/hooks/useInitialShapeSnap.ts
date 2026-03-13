import { useLayoutEffect } from "react";
import { IShapes } from "@/shared/models/IShapes";
import { snapToShapeInitial } from "../utilities/snapToShape";

export function useInitialShapeSnap({
  marker,
  shapePoints,
  vehiclePosition,
  lastIndexRef,
  lastSnappedPositionRef,
  onSnapped,
}: {
  marker: google.maps.marker.AdvancedMarkerElement | null;
  shapePoints: IShapes[];
  vehiclePosition: { lat: number; lng: number } | null;
  lastIndexRef: React.MutableRefObject<number | null>;
  lastSnappedPositionRef?: React.MutableRefObject<{ lat: number; lng: number } | null>;
  onSnapped?: () => void;
}) {
  useLayoutEffect(() => {
    if (!marker || !vehiclePosition || shapePoints.length === 0) return;
    if (lastIndexRef.current !== null) return;

    const snap = snapToShapeInitial(vehiclePosition, shapePoints);

    marker.position = new google.maps.LatLng(snap.lat, snap.lng);
    lastIndexRef.current = snap.shapeIndex;
    if (lastSnappedPositionRef) {
      lastSnappedPositionRef.current = { lat: snap.lat, lng: snap.lng };
    }
    onSnapped?.();
  }, [marker, vehiclePosition, shapePoints, lastIndexRef, lastSnappedPositionRef, onSnapped]);
}