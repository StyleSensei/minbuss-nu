import { useEffect, useRef } from "react";
import { projectRtToShape } from "../utilities/projectPointOnSegment";
import { IShapes } from "@/shared/models/IShapes";
import gsap from "gsap";

interface Props {
  marker: google.maps.marker.AdvancedMarkerElement | null;
  vehiclePosition: { lat: number; lng: number };
  shapePoints: IShapes[];
  duration?: number;
  /** Synka med initial snap så att vi inte startar från segment 0 och flyttar markören fel. */
  initialLastIndexRef?: React.MutableRefObject<number | null>;
}
export function useRtTimeline({
  marker,
  vehiclePosition,
  shapePoints,
  duration,
  initialLastIndexRef,
}: Props) {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lastIndexRef = useRef<number>(0);
  const shapePointsRef = useRef(shapePoints);
  const durationRef = useRef(duration);
  shapePointsRef.current = shapePoints;
  durationRef.current = duration;

  useEffect(() => {
    const shapePoints = shapePointsRef.current;
    const duration = durationRef.current;
    if (!marker || shapePoints.length < 2) return;

    // Synka med initial snap: använd samma segment som useInitialShapeSnap satte så att vi inte hoppar från 0.
    if (initialLastIndexRef?.current != null && lastIndexRef.current === 0) {
      lastIndexRef.current = initialLastIndexRef.current;
    }

    // 1️⃣ Markörens faktiska position (ankare)
    const anchor = marker.position
      ? {
          lat: +marker.position.lat,
          lng: +marker.position.lng,
        }
      : vehiclePosition;

    const anchorProjection = projectRtToShape(
      anchor,
      shapePoints,
      lastIndexRef.current
    );

    // 2️⃣ RT är facit – sök både bakåt och framåt så att vi hittar bussen även om den ligger före markören
    const rtStartIndex = Math.max(0, anchorProjection.index - 100);
    const rtSearchWindow = 400;
    const rtProjection = projectRtToShape(
      vehiclePosition,
      shapePoints,
      rtStartIndex,
      rtSearchWindow
    );

    // 3️⃣ Låt markören följa RT-projektionen längs rutten,
    // men med skydd mot orimliga hopp.
    // Slappare tröskel (5e-3) så att bussar några km från shape fortfarande snappar och inte stannar.
    const MAX_RT_DIST2 = 5e-3;
    const snapAllowed = rtProjection.dist2 < MAX_RT_DIST2;
    const SOFT_SNAP_MAX_DIST2 = 0.1;
    const softSnapAllowed = rtProjection.dist2 < SOFT_SNAP_MAX_DIST2;

    const rawTargetIndex = rtProjection.index;
    // Rör aldrig markören bakåt: clamp till både lastIndexRef och markörens nuvarande position (anchor).
    const effectiveTargetIndex = Math.min(
      Math.max(rawTargetIndex, lastIndexRef.current, anchorProjection.index),
      shapePoints.length - 1
    );
    const effectiveTarget = shapePoints[effectiveTargetIndex];

    const indexDelta = Math.abs(effectiveTargetIndex - anchorProjection.index);
    const targetIndex = effectiveTargetIndex;
    const target = effectiveTarget;

    const MAX_INDEX_DELTA_FOR_ANIMATION = 30;

    let snapMode: "animate" | "direct" | "skip";
    if (!snapAllowed) {
      snapMode = "skip";
    } else if (indexDelta > MAX_INDEX_DELTA_FOR_ANIMATION) {
      snapMode = "direct";
    } else {
      snapMode = "animate";
    }

    // Hantera snap-beteende baserat på beräknat läge
    if (snapMode === "skip") {
      if (softSnapAllowed) {
        timelineRef.current?.kill();
        timelineRef.current = null;
        marker.position = new google.maps.LatLng(
          effectiveTarget.shape_pt_lat,
          effectiveTarget.shape_pt_lon
        );
        lastIndexRef.current = targetIndex;
      }
      return;
    }

    // Vid stora hopp längs rutten: sätt markören direkt till RT-projektionen
    // för att undvika att "flyga" fågelvägen över kartan.
    if (snapMode === "direct") {
      timelineRef.current?.kill();
      timelineRef.current = null;
      marker.position = new google.maps.LatLng(
        effectiveTarget.shape_pt_lat,
        effectiveTarget.shape_pt_lon
      );
      lastIndexRef.current = targetIndex;
      return;
    }

    // animate men ingen förflyttning längs rutten → starta inte ny animation
    if (indexDelta === 0) {
      return;
    }

    // Normal animation för korta steg längs rutten
    timelineRef.current?.kill();
    timelineRef.current = gsap.timeline();

    const from = {
      lat: anchorProjection.lat,
      lng: anchorProjection.lng,
    };

    const to = {
      lat: target.shape_pt_lat,
      lng: target.shape_pt_lon,
    };

    timelineRef.current.to(from, {
      lat: to.lat,
      lng: to.lng,
      duration,
      ease: "linear",
      onUpdate: () => {
        marker.position = new google.maps.LatLng(from.lat, from.lng);
      },
      onComplete: () => {
        lastIndexRef.current = targetIndex;
      },
    });

    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [
    marker,
    vehiclePosition.lat,
    vehiclePosition.lng,
  ]);
}