'use client';

export const metadata = {
  title: 'Se närmaste bussen live i Stockholm',
};

import {
  Map as GoogleMap,
  APIProvider,
  MapControl,
  ControlPosition,
  type MapEvent,
  AdvancedMarker,
} from '@vis.gl/react-google-maps';

import { useDataContext } from '../context/DataContext';
import { MapControlButtons } from '../components/MapControlButtons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IShapes } from '@shared/models/IShapes';
import type { IDbData } from '@shared/models/IDbData';
import { useIsMobile } from '../hooks/useIsMobile';
import { CurrentTrips } from '../components/CurrentTrips';
import UserMessage from '../components/UserMessage';
import VehicleMarkers from '../components/VehicleMarkers';
import RouteShapePolyline from '../components/RouteShapePolyline';

export default function MapClient() {
  const { filteredVehicles, tripData, userPosition, setUserPosition } =
    useDataContext();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [clickedOutside, setClickedOutside] = useState(false);
  const [zoomWindowLevel, setCurrentWindowZoomLevel] = useState(100);
  const [showCurrentTrips, setShowCurrentTrips] = useState(false);
  const [infoWindowActive, setInfoWindowActive] = useState(false);
  const [followBus, setFollowBus] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isMobile = useIsMobile();
  const zoomRef = useRef<number>(8);
  const [hideUserPositionForZoom, setHideUserPositionForZoom] = useState(false);
  const hideUserPositionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    const ctaButton = document.getElementById('cta');
    const backgroundImage = document.getElementById('background-image');
    ctaButton?.classList.add('--hidden');
    backgroundImage?.classList.add('--hidden');

    return () => {
      ctaButton?.classList.remove('--hidden');
      backgroundImage?.classList.remove('--hidden');
    };
  }, []);

  useEffect(() => {
    const main = document.getElementById('follow-bus-border');
    if (followBus && filteredVehicles.data.length > 0) {
      main?.classList.add('follow-bus-active');
    } else {
      main?.classList.remove('follow-bus-active');
    }
    return () => {
      main?.classList.remove('follow-bus-active');
    };
  }, [followBus, filteredVehicles.data.length]);

  const getTripsByStopId = useCallback(
    (array: IDbData[]) => {
      if (!userPosition?.tripsAtClosestStop) {
        return [];
      }
      return array.filter(
        (item) => item.stop_id === userPosition?.closestStop?.stop_id,
      );
    },
    [userPosition?.closestStop?.stop_id, userPosition?.tripsAtClosestStop],
  );

  useEffect(() => {
    if (!userPosition) return;

    const tripsAtClosestStop = getTripsByStopId(tripData.currentTrips);

    if (
      JSON.stringify(tripsAtClosestStop) !==
      JSON.stringify(userPosition.tripsAtClosestStop)
    ) {
      setUserPosition((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          tripsAtClosestStop,
        };
      });
    }
  }, [tripData.currentTrips, getTripsByStopId, userPosition, setUserPosition]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not defined');
  }

  const zoomIn = useCallback((GoogleMap: google.maps.Map) => {
    // biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
    GoogleMap.setZoom(GoogleMap.getZoom()! + 1);
  }, []);
  const zoomOut = useCallback((GoogleMap: google.maps.Map) => {
    // biome-ignore lint/style/noNonNullAssertion: <Returns the zoom of the map. If the zoom has not been set then the result is undefined.>
    GoogleMap.setZoom(GoogleMap.getZoom()! - 1);
  }, []);

  const getWindowZoomLevel = useCallback(() => {
    const zoomLevel = ((window.outerWidth - 10) / window.innerWidth) * 100;
    setCurrentWindowZoomLevel(zoomLevel);
    return zoomLevel;
  }, []);

  const handleTripSelect = useCallback(
    (tripId: string) => {
      const vehicle = filteredVehicles.data.find(
        (v) => v.trip.tripId === tripId,
      );
      if (vehicle) {
        setInfoWindowActive(false);
        setActiveMarkerId(null);

        setTimeout(() => {
          setActiveMarkerId(vehicle.vehicle.id);
          setClickedOutside(false);
          setInfoWindowActive(true);

          if (mapRef.current && vehicle.position) {
            mapRef.current.panTo({
              lat: vehicle.position.latitude,
              lng: vehicle.position.longitude,
            });
          }
          if (isMobile) {
            setShowCurrentTrips(false);
          }
        }, 50);
        mapRef?.current?.setZoom(17);
      }
    },
    [filteredVehicles, isMobile],
  );

  useEffect(() => {
    window.addEventListener('resize', getWindowZoomLevel);
    window.addEventListener('zoom', getWindowZoomLevel);

    getWindowZoomLevel();

    return () => {
      window.removeEventListener('resize', getWindowZoomLevel);
      window.removeEventListener('zoom', getWindowZoomLevel);
    };
  }, [getWindowZoomLevel]);

  useEffect(() => {
    if (mapRef.current) {
      if (mapRef.current) {
        const listener = google.maps.event.addListener(
          mapRef.current,
          'zoom_changed',
          () => {
            const newZoom = mapRef.current?.getZoom()!;
            if (newZoom !== zoomWindowLevel) {
              zoomRef.current = newZoom;
              setHideUserPositionForZoom(true);
              if (hideUserPositionTimeoutRef.current) {
                clearTimeout(hideUserPositionTimeoutRef.current);
              }
              hideUserPositionTimeoutRef.current = setTimeout(() => {
                setHideUserPositionForZoom(false);
                hideUserPositionTimeoutRef.current = null;
              }, 400);
            }
          },
        );

        return () => {
          if (hideUserPositionTimeoutRef.current) {
            clearTimeout(hideUserPositionTimeoutRef.current);
          }
          if (listener) {
            google.maps.event.removeListener(listener);
          }
        };
      }
    }
  }, [mapRef.current]);

  // Unika shapes för vald linje – cachad så att nya positioner inte ger nya referenser och ritar om rutten
  const routeShapesCacheRef = useRef<Map<string, IShapes[]>>(new Map());
  const routeShapes = useMemo(() => {
    const seen = new Set<string>();
    const shapes: { shape_id: string; points: IShapes[] }[] = [];
    for (const v of filteredVehicles.data) {
      if (!v.shapePoints?.length) continue;
      const id = v.shapePoints[0].shape_id;
      if (seen.has(id)) continue;
      seen.add(id);
      const points = v.shapePoints;
      const cached = routeShapesCacheRef.current.get(id);
      const sameShape =
        cached &&
        cached.length === points.length &&
        cached[0].shape_pt_lat === points[0].shape_pt_lat &&
        cached[0].shape_pt_lon === points[0].shape_pt_lon &&
        cached[cached.length - 1].shape_pt_lat ===
          points[points.length - 1].shape_pt_lat &&
        cached[cached.length - 1].shape_pt_lon ===
          points[points.length - 1].shape_pt_lon;
      const toUse = sameShape ? cached : points;
      if (!sameShape) routeShapesCacheRef.current.set(id, points);
      shapes.push({ shape_id: id, points: toUse });
    }
    return shapes;
  }, [filteredVehicles.data]);

  return (
    <div>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          style={{ width: '100vw', height: '100dvh', zIndex: 'unset' }}
          defaultZoom={10}
          minZoom={10}
          defaultCenter={{ lat: 59.33258, lng: 18.0649 }}
          gestureHandling={'greedy'}
          onTilesLoaded={(e: MapEvent) => {
            const map = e.map as google.maps.Map;
            mapRef.current = map;
            setMapReady(true);
          }}
          mapId={'SHOW_BUSES'}
          onZoomChanged={() => setFollowBus(false)}
          disableDefaultUI={true}
          rotateControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          onClick={() => setClickedOutside(true)}
          colorScheme='DARK'
          reuseMaps={true}
          restriction={{
            latLngBounds: { north: 60, south: 58.5, east: 20, west: 16.5 },
          }}
        >
          <MapControl position={ControlPosition.INLINE_END_BLOCK_CENTER}>
            <MapControlButtons
              googleMapRef={mapRef}
              zoomIn={zoomIn}
              zoomOut={zoomOut}
              setShowCurrentTrips={setShowCurrentTrips}
              showCurrentTrips={showCurrentTrips}
              filteredVehicles={filteredVehicles}
              setFollowBus={setFollowBus}
              followBus={activeMarkerId ? followBus : false}
              activeMarker={activeMarkerId !== null}
              mapReady={mapReady}
            />
          </MapControl>
          <VehicleMarkers
            googleMapRef={mapRef}
            clickedOutside={clickedOutside}
            setClickedOutside={setClickedOutside}
            vehicles={filteredVehicles.data}
            setInfoWindowActiveExternal={setInfoWindowActive}
            infoWindowActiveExternal={infoWindowActive}
            followBus={followBus}
            setFollowBus={setFollowBus}
            activeMarkerId={activeMarkerId}
            setActiveMarkerId={setActiveMarkerId}
            showCurrentTrips={showCurrentTrips}
          />
          {mapReady &&
            routeShapes.map(
              (s) =>
                s.points && (
                  <RouteShapePolyline
                    key={s.shape_id}
                    googleMapRef={mapRef}
                    shapePoints={s.points}
                    mapReady={mapReady}
                    animateReveal
                    animationDuration={1.8}
                  />
                ),
            )}
          {showCurrentTrips &&
            userPosition &&
            filteredVehicles.data.length > 0 && (
              <CurrentTrips onTripSelect={handleTripSelect} mapRef={mapRef} />
            )}
          {userPosition && mapRef.current && (
            <AdvancedMarker
              className='user-location'
              title={'Min position'}
              position={
                new google.maps.LatLng({
                  lat: userPosition.lat,
                  lng: userPosition.lng,
                })
              }
            >
              <div
                className={`user-location__container ${mapRef.current?.getZoom()! >= 13 && !hideUserPositionForZoom ? '--visible' : ''}`}
              >
                <span
                  className='user-location__text'
                  style={{ fontSize: mapRef.current?.getZoom()! * 0.8 }}
                >
                  Min position
                </span>
              </div>
            </AdvancedMarker>
          )}
        </GoogleMap>
      </APIProvider>
      {!userPosition && <UserMessage />}
      <div id='follow-bus-border' />
    </div>
  );
}
