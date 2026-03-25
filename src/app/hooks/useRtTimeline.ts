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
  const prevShapeMetaRef = useRef<{ shapeId: string | null; shapeLen: number } | null>(
    null
  );
  const shapePointsRef = useRef(shapePoints);
  const durationRef = useRef(duration);
  shapePointsRef.current = shapePoints;
  durationRef.current = duration;

  useEffect(() => {
    const shapePoints = shapePointsRef.current;
    const duration = durationRef.current;
    if (!marker || shapePoints.length < 2) return;

    const pointOnSegment = (index: number, t: number) => {
      const a = shapePoints[index];
      const b = shapePoints[Math.min(index + 1, shapePoints.length - 1)];
      return {
        lat: a.shape_pt_lat + (b.shape_pt_lat - a.shape_pt_lat) * t,
        lng: a.shape_pt_lon + (b.shape_pt_lon - a.shape_pt_lon) * t,
      };
    };

    const shapeMeta = {
      shapeId: shapePoints[0]?.shape_id ?? null,
      shapeLen: shapePoints.length,
      first: shapePoints[0]
        ? { lat: shapePoints[0].shape_pt_lat, lng: shapePoints[0].shape_pt_lon }
        : null,
      last: shapePoints[shapePoints.length - 1]
        ? {
            lat: shapePoints[shapePoints.length - 1].shape_pt_lat,
            lng: shapePoints[shapePoints.length - 1].shape_pt_lon,
          }
        : null,
    };

    // Om shape byts (eller längden ändras) kan lastIndexRef hamna utanför range och ge fel projektion → "hopp".
    const prevShape = prevShapeMetaRef.current;
    const shapeChanged =
      !prevShape ||
      prevShape.shapeId !== (shapeMeta.shapeId as string | null) ||
      prevShape.shapeLen !== shapeMeta.shapeLen;
    if (shapeChanged) {
      timelineRef.current?.kill();
      timelineRef.current = null;
      // Reset progress för den nya shapen och synka markören till en rimlig startpunkt.
      // Viktigt: om markören står kvar på en gammal shape kan projektionen mot nya shapen bli "lång" → hopp.
      const resetProjection = projectRtToShape(vehiclePosition, shapePoints, 0, 400);
      const RESET_MAX_DIST2 = 8e-4; // matchar soft-snap: bara om nya shapen ligger nära RT
      if (resetProjection.dist2 < RESET_MAX_DIST2) {
        marker.position = new google.maps.LatLng(
          resetProjection.lat,
          resetProjection.lng
        );
        lastIndexRef.current = resetProjection.index;
      } else {
        // Om shapen inte matchar RT: lämna markören på RT (ingen shape-snap).
        marker.position = new google.maps.LatLng(vehiclePosition.lat, vehiclePosition.lng);
        lastIndexRef.current = 0;
      }
      prevShapeMetaRef.current = {
        shapeId: shapeMeta.shapeId as string | null,
        shapeLen: shapeMeta.shapeLen,
      };
    }

    // Klampa alltid till giltigt segmentindex.
    if (shapeMeta.shapeLen >= 2) {
      const maxSeg = shapeMeta.shapeLen - 2;
      if (lastIndexRef.current > maxSeg) {
        lastIndexRef.current = maxSeg;
      }
    }

    const animateAlongShape = (opts: {
      from: { lat: number; lng: number };
      fromIndex: number;
      to: { lat: number; lng: number };
      toIndex: number;
      durationSeconds: number;
      onComplete?: () => void;
    }) => {
      const { from, fromIndex, to, toIndex, durationSeconds, onComplete } = opts;

      // Bygg en diskret path: start (projektion) → vertices → slut (projektion).
      const points: Array<{ lat: number; lng: number }> = [{ ...from }];
      for (let i = Math.min(fromIndex + 1, shapePoints.length - 1); i <= toIndex; i++) {
        const p = shapePoints[i];
        points.push({ lat: p.shape_pt_lat, lng: p.shape_pt_lon });
      }
      points.push({ ...to });

      const segLens: number[] = [];
      let total = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.lng - a.lng;
        const dy = b.lat - a.lat;
        const len = Math.hypot(dx, dy);
        segLens.push(len);
        total += len;
      }

      if (total === 0) {
        marker.position = new google.maps.LatLng(to.lat, to.lng);
        onComplete?.();
        return;
      }

      const cursor = { d: 0 };
      timelineRef.current?.kill();
      timelineRef.current = gsap.timeline();
      timelineRef.current.to(cursor, {
        d: total,
        duration: durationSeconds,
        ease: "linear",
        onUpdate: () => {
          let remaining = cursor.d;
          let segIdx = 0;
          while (segIdx < segLens.length && remaining > segLens[segIdx]) {
            remaining -= segLens[segIdx];
            segIdx++;
          }
          if (segIdx >= segLens.length) {
            marker.position = new google.maps.LatLng(to.lat, to.lng);
            return;
          }
          const a = points[segIdx];
          const b = points[segIdx + 1];
          const denom = segLens[segIdx] || 1;
          const t = remaining / denom;
          const lat = a.lat + (b.lat - a.lat) * t;
          const lng = a.lng + (b.lng - a.lng) * t;
          marker.position = new google.maps.LatLng(lat, lng);
        },
        onComplete,
      });
    };

    // Synka med initial snap: använd samma segment som useInitialShapeSnap satte så att vi inte hoppar från 0.
    if (initialLastIndexRef?.current != null && lastIndexRef.current === 0) {
      lastIndexRef.current = initialLastIndexRef.current;
    }

    const anchor = marker.position
      ? {
          lat:
            typeof (marker.position as any).lat === "function"
              ? +(marker.position as any).lat()
              : +(marker.position as any).lat,
          lng:
            typeof (marker.position as any).lng === "function"
              ? +(marker.position as any).lng()
              : +(marker.position as any).lng,
        }
      : vehiclePosition;

    // Ankaret (markörens faktiska position) kan ligga lite före/efter `lastIndexRef` p.g.a. pågående tween.
    // Om vi bara söker framåt från `lastIndexRef` kan vi missa rätt segment och få en projicering på fel punkt,
    // vilket ser ut som att markören "hoppar" fram längs shapen.
    const anchorStartIndex = Math.max(0, Math.min(lastIndexRef.current, shapePoints.length - 2) - 120);
    const anchorProjection = projectRtToShape(
      anchor,
      shapePoints,
      anchorStartIndex,
      300
    );

    // Monoton progress längs shapen: tillåt aldrig att vi går bakåt i index.
    // Vi använder anchorProjection för att hitta närmaste segment, men "progress" får inte minska.
    const progressIndex = Math.min(
      shapePoints.length - 2,
      Math.max(anchorProjection.index, lastIndexRef.current)
    );
    // Startpunkt för animation: använd markörens faktiska position (ankaret).
    // Vi håller progressIndex monotont för att inte gå bakåt i index,
    // men vi får inte "snappa" frånIndex-positionen framåt till segmentstart bara för att progressIndex > anchorIndex.
    const progressPoint = { lat: anchor.lat, lng: anchor.lng };

    // 2️⃣ RT är facit – sök både bakåt och framåt så att vi hittar bussen även om den ligger före markören
    const rtStartIndex = Math.max(0, progressIndex - 100);
    const rtSearchWindow = 400;
    const rtProjection = projectRtToShape(
      vehiclePosition,
      shapePoints,
      rtStartIndex,
      rtSearchWindow
    );


    // Tröskel för att acceptera RT-projektionen. För stora avvikelser från shapen ger upplevda "hopp"
    // när vi snappar till en helt annan del av rutten. Håll detta relativt strikt.
    const MAX_RT_DIST2 = 2e-4;
    const snapAllowed = rtProjection.dist2 < MAX_RT_DIST2;
    const SOFT_SNAP_MAX_DIST2 = 8e-4;
    const softSnapAllowed = rtProjection.dist2 < SOFT_SNAP_MAX_DIST2;

    const rawTargetIndex = rtProjection.index;
    // Rör aldrig markören bakåt och begränsa hur långt fram den kan hoppa per uppdatering.
    const baseIndex = Math.max(lastIndexRef.current, progressIndex);
    const MAX_FORWARD_INDEX_STEP = 12;
    const unclampedTargetIndex = Math.min(
      Math.max(rawTargetIndex, baseIndex),
      shapePoints.length - 1
    );
    const effectiveTargetIndex = Math.min(
      unclampedTargetIndex,
      Math.min(shapePoints.length - 1, baseIndex + MAX_FORWARD_INDEX_STEP)
    );

    const indexDelta = Math.abs(effectiveTargetIndex - progressIndex);
    const targetIndex = effectiveTargetIndex;
    const targetT = targetIndex === rtProjection.index ? rtProjection.t : 1;
    const target = pointOnSegment(targetIndex, targetT);
    const forwardClamped = unclampedTargetIndex !== effectiveTargetIndex;

    const durationForDelta = (
      delta: number,
      opts?: { min?: number; max?: number; base?: number; perIndex?: number }
    ) => {
      const min = opts?.min ?? 1.2;
      const max = opts?.max ?? 8;
      const base = opts?.base ?? 0.9;
      const perIndex = opts?.perIndex ?? 0.25;
      return Math.max(min, Math.min(max, base + delta * perIndex));
    };

    const MAX_INDEX_DELTA_FOR_ANIMATION = 30;

    let snapMode: "animate" | "direct" | "skip";
    if (!snapAllowed) {
      snapMode = "skip";
    } else if (indexDelta > MAX_INDEX_DELTA_FOR_ANIMATION) {
      snapMode = "direct";
    } else {
      snapMode = "animate";
    }

    // Om vi startar en längre "catch-up" (särskilt när vi forward-clampar) kan effekten triggas igen
    // innan tweenen hinner bli klar → lastIndexRef uppdateras aldrig och vi försöker catch-up:a om och om igen.
    // Optimistiskt avancera lastIndexRef direkt så nästa tick utgår från den nya positionen längs shapen.
    if (effectiveTargetIndex > lastIndexRef.current) {
      lastIndexRef.current = effectiveTargetIndex;
    }

    // Hantera snap-beteende baserat på beräknat läge
    if (snapMode === "skip") {
      if (softSnapAllowed) {
        // Om RT ligger lite för långt från shapen vill vi ändå "dra tillbaka" markören,
        // men gör det animerat längs rutten för att undvika teleport.
        animateAlongShape({
          from: progressPoint,
          fromIndex: progressIndex,
          to: { lat: target.lat, lng: target.lng },
          toIndex: targetIndex,
          durationSeconds: durationForDelta(indexDelta, { min: 1.6, max: 5, base: 1.2, perIndex: 0.2 }),
          onComplete: () => {
            lastIndexRef.current = targetIndex;
          },
        });
      }
      return;
    }

    // Vid stora hopp längs rutten: sätt markören direkt till RT-projektionen
    // för att undvika att "flyga" fågelvägen över kartan.
    if (snapMode === "direct") {
      // Snabb "catch-up" längs shapen istället för instant teleport.
      animateAlongShape({
        from: progressPoint,
        fromIndex: progressIndex,
        to: { lat: target.lat, lng: target.lng },
        toIndex: targetIndex,
        durationSeconds: durationForDelta(indexDelta, { min: 2.0, max: 6, base: 1.4, perIndex: 0.22 }),
        onComplete: () => {
          lastIndexRef.current = targetIndex;
        },
      });
      return;
    }

    // animate men ingen förflyttning längs rutten → starta inte ny animation
    if (indexDelta === 0) {
      // Samma segment: uppdatera till ankarets projektion.
      // Viktigt: om vi clamp:ar index framåt kan `targetT` bli 1 (segmentets slut)
      // trots att RT/projektionen ligger mitt på segmentet → upplevt "hopp".
      // Ingen positionsändring – behåll nuvarande marker.position.
      lastIndexRef.current = targetIndex;
      return;
    }

    // Normal animation för korta steg längs rutten (path-baserad, en tween).

    // När vi ligger efter (framåt-clamp) vill vi ta igen snabbare än "normal" duration,
    // annars triggas effekten igen innan tweenen blir klar och det upplevs som hopp.
    const durationSeconds =
      forwardClamped || indexDelta >= MAX_FORWARD_INDEX_STEP
        ? Math.min(2.5, duration ?? 8)
        : duration ?? durationForDelta(indexDelta, { min: 1.4, max: 10, base: 1.0, perIndex: 0.28 });

    animateAlongShape({
      from: progressPoint,
      fromIndex: progressIndex,
      to: { lat: target.lat, lng: target.lng },
      toIndex: targetIndex,
      durationSeconds,
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