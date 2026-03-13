import type { IShapes } from "@shared/models/IShapes";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Projektion av punkt P på linjesegment AB
function projectPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) {
    return { t: 0, x: ax, y: ay };
  }

  const t = clamp((apx * abx + apy * aby) / abLen2, 0, 1);

  return {
    t,
    x: ax + abx * t,
    y: ay + aby * t,
  };
}

export function projectRtToShape(
  rt: { lat: number; lng: number },
  shape: IShapes[],
  startIndex = 0,
  searchWindow = 200
) {
  if (shape.length < 2) {
    return {
      index: 0,
      t: 0,
      lat: shape[0]?.shape_pt_lat ?? rt.lat,
      lng: shape[0]?.shape_pt_lon ?? rt.lng,
      dist2: Number.POSITIVE_INFINITY,
    };
  }
  const safeStart = clamp(startIndex, 0, shape.length - 1);
  let best = {
    index: safeStart,
    t: 0,
    lat: shape[safeStart].shape_pt_lat,
    lng: shape[safeStart].shape_pt_lon,
    dist2: Number.POSITIVE_INFINITY,
  };

  const end = Math.min(shape.length - 1, safeStart + searchWindow);

  for (let i = safeStart; i < end; i++) {
    const a = shape[i];
    const b = shape[i + 1];

    const proj = projectPointOnSegment(
      rt.lng,
      rt.lat,
      a.shape_pt_lon,
      a.shape_pt_lat,
      b.shape_pt_lon,
      b.shape_pt_lat
    );

    const dx = proj.x - rt.lng;
    const dy = proj.y - rt.lat;
    const d2 = dx * dx + dy * dy;

    if (d2 < best.dist2) {
      best = {
        index: i,
        t: proj.t,
        lat: proj.y,
        lng: proj.x,
        dist2: d2,
      };
    }
  }

  return best;
}