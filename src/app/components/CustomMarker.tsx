'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDataContext } from '../context/DataContext';
import type { IDbData } from '@shared/models/IDbData';
import type { IVehiclePosition } from '@shared/models/IVehiclePosition';
import type { IShapes } from '@shared/models/IShapes';
import { InfoWindow } from './InfoWindow';
import { getClosest } from '../utilities/getClosest';
import { useCheckIfFurtherFromStop } from '../hooks/useCheckIfFurther';
import { useSetZoom } from '../hooks/useSetZoom';
import { useIsMobile } from '../hooks/useIsMobile';
import { useInitialShapeSnap } from '../hooks/useInitialShapeSnap';
import { useRtTimeline } from '../hooks/useRtTimeline';
import { snapToShapeInitial } from '../utilities/snapToShape';
import { projectRtToShape } from '../utilities/projectPointOnSegment';

interface ICustomMarkerProps {
  position: { lat: number; lng: number };
  currentVehicle: IVehiclePosition;
  googleMapRef: MutableRefObject<google.maps.Map | null>;
  clickedOutside: boolean;
  setClickedOutside: (value: boolean) => void;
  infoWindowActiveExternal: boolean;
  setInfoWindowActiveExternal: (value: boolean) => void;
  followBus: boolean;
  setFollowBus: (value: boolean) => void;
  isActive: boolean;
  showCurrentTrips: boolean;
  onActivateMarker: (id: string | null) => void;
  tripsByTripId: Map<string, IDbData[]>;
}

export default function CustomMarker({
  googleMapRef,
  position,
  currentVehicle,
  clickedOutside,
  setClickedOutside,
  infoWindowActiveExternal,
  setInfoWindowActiveExternal,
  followBus,
  setFollowBus,
  isActive,
  showCurrentTrips,
  onActivateMarker,
  tripsByTripId,
}: ICustomMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [closestStopState, setClosestStop] = useState<IDbData | null>(null);
  const [currentBus, setCurrentBus] = useState<IVehiclePosition | undefined>(
    currentVehicle,
  );

  const { filteredVehicles } = useDataContext();
  const [infoWindowActive, setInfoWindowActive] = useState(
    infoWindowActiveExternal,
  );
  const checkIfFurtherFromStop = useCheckIfFurtherFromStop();
  const setZoom = useSetZoom();
  const isMobile = useIsMobile();
  const zoomRef = useRef<number>(8);
  const [hideDestinationForZoom, setHideDestinationForZoom] = useState(false);
  const hideDestinationTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const markerAnimationRef = useRef<gsap.core.Tween | null>(null);
  const followAnimationRef = useRef<gsap.core.Tween | null>(null);
  const lastShapeIndexRef = useRef<number | null>(null);
  const [markerReady, setMarkerReady] = useState(false);
  const lockedShapeRef = useRef<{ shapeId: string; points: IShapes[] } | null>(
    null,
  );

  const incomingShapePoints = currentVehicle.shapePoints ?? [];
  const incomingShapeId =
    incomingShapePoints.length > 0 ? incomingShapePoints[0].shape_id : null;
  const vehiclePosition = {
    lat: position.lat,
    lng: position.lng,
  };

  // Lås shape per fordon för att undvika att markören "hoppar" när shapeId flappar i datan.
  // Byt bara till ny shape om den nya ligger nära RT-positionen.
  const shapePoints = useMemo(() => {
    const locked = lockedShapeRef.current;

    // Om vi temporärt saknar shape (t.ex. p.g.a. flapp i datan), behåll senast låsta shape
    // i stället för att släppa den (vilket kan orsaka hopp när den kommer tillbaka).
    if (!incomingShapeId || incomingShapePoints.length < 2) {
      return locked?.points ?? incomingShapePoints;
    }

    if (!locked) {
      lockedShapeRef.current = { shapeId: incomingShapeId, points: incomingShapePoints };
      return incomingShapePoints;
    }

    if (locked.shapeId === incomingShapeId) {
      lockedShapeRef.current = { shapeId: incomingShapeId, points: incomingShapePoints };
      return incomingShapePoints;
    }

    const proj = projectRtToShape(vehiclePosition, incomingShapePoints, 0, 300);
    const SWITCH_SHAPE_MAX_DIST2 = 2e-4;
    if (proj.dist2 < SWITCH_SHAPE_MAX_DIST2) {
      lockedShapeRef.current = { shapeId: incomingShapeId, points: incomingShapePoints };
      return incomingShapePoints;
    }

    return locked.points;
  }, [incomingShapeId, incomingShapePoints, vehiclePosition.lat, vehiclePosition.lng]);

  const initialSnapPosition =
    shapePoints.length >= 2
      ? snapToShapeInitial(vehiclePosition, shapePoints)
      : null;
  const positionForMarker =
    marker?.position ??
    (initialSnapPosition
      ? { lat: initialSnapPosition.lat, lng: initialSnapPosition.lng }
      : vehiclePosition);

  const onSnapped = useCallback(() => setMarkerReady(true), []);

  useEffect(() => {
    setCurrentBus(currentVehicle);
  }, [currentVehicle]);

  const tripForMarker = useMemo(
    () => tripsByTripId.get(currentVehicle?.trip?.tripId ?? '')?.[0],
    [currentVehicle?.trip?.tripId, tripsByTripId],
  );

  const currentLine = tripForMarker?.route_short_name;
  const currentDestination = tripForMarker?.stop_headsign;

  useLayoutEffect(() => {
    lastShapeIndexRef.current = null;
    setMarkerReady(false);
    lockedShapeRef.current = null;
  }, [currentVehicle?.vehicle?.id]);

  useInitialShapeSnap({
    marker,
    shapePoints,
    vehiclePosition,
    lastIndexRef: lastShapeIndexRef,
    onSnapped,
  });

  useRtTimeline({
    marker,
    vehiclePosition,
    shapePoints,
    duration: 8,
    initialLastIndexRef: lastShapeIndexRef,
  });

  useGSAP(() => {
    if (marker && !currentVehicle.shapePoints?.length) {
      if (markerAnimationRef.current) {
        markerAnimationRef.current.kill();
      }

      const currentPosition = marker.position
        ? { lat: marker.position.lat, lng: marker.position.lng }
        : position;

      markerAnimationRef.current = gsap.to(currentPosition, {
        duration: 8,
        ease: 'easeInOut',
        lat: position.lat,
        lng: position.lng,
        overwrite: 'auto',
        lazy: true,
        onUpdate: () => {
          if (marker) {
            marker.position = new google.maps.LatLng(
              +currentPosition.lat,
              +currentPosition.lng,
            );
          }
        },
      });
    }

    return () => {
      if (markerAnimationRef.current) {
        markerAnimationRef.current.kill();
        markerAnimationRef.current = null;
      }
    };
  }, [position, marker, currentVehicle.shapePoints]);

  const stopsOnCurrentTrip = useMemo(() => {
    const tripId = currentBus?.trip?.tripId;
    if (!tripId) return [];
    return tripsByTripId.get(tripId) ?? [];
  }, [currentBus?.trip?.tripId, tripsByTripId]);

  const findClosestOrNextStop = useCallback(() => {
    if (!currentBus) return null;

    const busLat = currentBus.position.latitude;
    const busLon = currentBus.position.longitude;

    if (stopsOnCurrentTrip.length === 0) return null;

    const closestStop = getClosest(stopsOnCurrentTrip, busLat, busLon) as IDbData;

    const isMovingAway = checkIfFurtherFromStop(currentBus, closestStop, true);

    const nextStop = stopsOnCurrentTrip.find(
      (stop) => stop.stop_sequence > closestStop.stop_sequence,
    );

    if (isMovingAway && nextStop) {
      return {
        closestStop: nextStop,
        nextStop: stopsOnCurrentTrip.find(
          (stop) => stop.stop_sequence > nextStop.stop_sequence,
        ),
      };
    }

    return {
      closestStop,
      nextStop,
    };
  }, [stopsOnCurrentTrip, currentBus, checkIfFurtherFromStop]);

  const handleOnClick = () => {
    if (followBus) return;
    if (currentBus) onActivateMarker(isActive ? null : currentBus?.vehicle?.id);
    setClickedOutside(false);
    setInfoWindowActive(!infoWindowActive);
    if (googleMapRef.current) {
      setZoom(googleMapRef.current);
      panTo(googleMapRef.current);
    }
  };

  useGSAP(() => {
    if (marker && followBus && isActive && googleMapRef.current) {
      if (followAnimationRef.current) {
        followAnimationRef.current.kill();
      }

      const proxy = { _: 0 };
      followAnimationRef.current = gsap.to(proxy, {
        _: 1,
        duration: 99999,
        ease: 'none',
        onUpdate: () => {
          if (marker?.position && googleMapRef.current) {
            const lat =
              typeof marker.position.lat === 'function'
                ? marker.position.lat()
                : marker.position.lat;
            const lng =
              typeof marker.position.lng === 'function'
                ? marker.position.lng()
                : marker.position.lng;
            googleMapRef.current.setCenter(new google.maps.LatLng(+lat, +lng));
          }
        },
      });
    }

    return () => {
      if (followAnimationRef.current) {
        followAnimationRef.current.kill();
        followAnimationRef.current = null;
      }
    };
  }, [marker, isActive, followBus, googleMapRef]);

  useEffect(() => {
    if (!followBus && followAnimationRef.current) {
      followAnimationRef.current.kill();
      followAnimationRef.current = null;
    }
  }, [followBus]);

  useEffect(() => {
    return () => {
      if (markerAnimationRef.current) {
        markerAnimationRef.current.kill();
      }
      if (followAnimationRef.current) {
        followAnimationRef.current.kill();
      }

      if (marker?.position) {
        gsap.killTweensOf(marker.position);
      }
    };
  }, [marker]);

  const panTo = useCallback(
    (GoogleMap: google.maps.Map) => {
      if (marker?.position) {
        GoogleMap.panTo(marker.position);
      }
    },
    [marker],
  );

  useEffect(() => {
    if (isActive && currentBus) {
      const closestOrNextStop = findClosestOrNextStop();

      if (closestOrNextStop?.closestStop) {
        setClosestStop(closestOrNextStop.closestStop);
      }
    }
  }, [isActive, currentBus, findClosestOrNextStop]);

  useEffect(() => {
    if (infoWindowActive) {
      setInfoWindowActiveExternal(true);
    }
    if (!infoWindowActive) {
      setInfoWindowActiveExternal(false);
    }
  }, [infoWindowActive, setInfoWindowActiveExternal]);

  useEffect(() => {
    if (clickedOutside) {
      setInfoWindowActive(false);
      setFollowBus(false);
      onActivateMarker(null);
      return;
    }
  }, [clickedOutside, setFollowBus, onActivateMarker]);

  useEffect(() => {
    if (!currentBus || !infoWindowActive) return;
    const closestOrNextStop = findClosestOrNextStop();
    if (closestOrNextStop?.closestStop) {
      setClosestStop(closestOrNextStop.closestStop);
    }
  }, [currentBus, infoWindowActive, findClosestOrNextStop]);

  useEffect(() => {
    if (filteredVehicles.data.length) {
      if (googleMapRef.current) {
        const listener = google.maps.event.addListener(
          googleMapRef.current,
          'zoom_changed',
          () => {
            const newZoom = googleMapRef.current?.getZoom()!;
            if (newZoom !== zoomRef.current) {
              zoomRef.current = newZoom;
              setHideDestinationForZoom(true);
              if (hideDestinationTimeoutRef.current) {
                clearTimeout(hideDestinationTimeoutRef.current);
              }
              hideDestinationTimeoutRef.current = setTimeout(() => {
                setHideDestinationForZoom(false);
                hideDestinationTimeoutRef.current = null;
              }, 400);
            }
          },
        );

        return () => {
          if (hideDestinationTimeoutRef.current) {
            clearTimeout(hideDestinationTimeoutRef.current);
          }
          if (listener) {
            google.maps.event.removeListener(listener);
          }
        };
      }
    }
  }, [filteredVehicles, googleMapRef]);

  const markerTitle = tripForMarker
    ? `${tripForMarker.route_short_name || 'Okänd linje'},${tripForMarker.stop_headsign || 'Okänd destination'}`
    : 'Fordon';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={positionForMarker}
        anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
        className={`marker-wrapper ${markerReady || shapePoints.length < 2 ? '' : 'marker-hidden'}`}
        title={markerTitle}
        onClick={() => (googleMapRef.current ? handleOnClick() : null)}
      >
        <div
          className={`custom-marker ${isActive ? '--active' : ''}`}
          style={
            zoomRef?.current < 11
              ? {
                  width: zoomRef.current * 1.5,
                  height: zoomRef.current * 1.5,
                }
              : undefined
          }
        />
        <div
          className={`line-destination-container ${zoomRef.current >= 13 && !hideDestinationForZoom ? '--visible' : ''}`}
        >
          <span
            className='line-text'
            style={{ fontSize: zoomRef.current * 0.8 }}
          >
            {currentLine ? `${currentLine}, ` : ''}
            {currentDestination}
          </span>
        </div>
      </AdvancedMarker>
      {isActive && (
        <InfoWindow
          closestStopState={closestStopState}
          tripId={currentBus?.trip.tripId ?? undefined}
          googleMapRef={googleMapRef}
          style={
            showCurrentTrips && isMobile
              ? { display: 'none' }
              : { display: 'block' }
          }
        />
      )}
    </>
  );
}
