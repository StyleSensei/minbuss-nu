import type { IShapes } from "@shared/models/IShapes";

function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
}

function projectPointOnSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
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

/** When dist2 values are within this margin, prefer the segment closest to `hintIndex`. */
const PROJECTION_TIE_DIST2_EPS = 4e-7;

export function projectRtToShape(
	rt: { lat: number; lng: number },
	shape: IShapes[],
	startIndex = 0,
	searchWindow = 200,
	hintIndex?: number,
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

	// Vi projicerar alltid mot ett SEGMENT (i och i+1). Därför måste startindex vara <= length-2.
	// Om vi hamnar på sista punkten blir loopen tom och dist2 blir Infinity (JSON -> null),
	// vilket kan trigga index-klampning och upplevda "hopp" längs shapen.
	const safeStart = clamp(startIndex, 0, shape.length - 2);
	let best = {
		index: safeStart,
		t: 0,
		lat: shape[safeStart].shape_pt_lat,
		lng: shape[safeStart].shape_pt_lon,
		dist2: Number.POSITIVE_INFINITY,
	};

	// i går till och med max-index för segmentstart (length-2)
	const end = Math.min(shape.length - 2, safeStart + searchWindow);

	for (let i = safeStart; i <= end; i++) {
		const a = shape[i];
		const b = shape[i + 1];

		const proj = projectPointOnSegment(
			rt.lng,
			rt.lat,
			a.shape_pt_lon,
			a.shape_pt_lat,
			b.shape_pt_lon,
			b.shape_pt_lat,
		);

		const dx = proj.x - rt.lng;
		const dy = proj.y - rt.lat;
		const d2 = dx * dx + dy * dy;

		const isClearlyCloser = d2 < best.dist2 - PROJECTION_TIE_DIST2_EPS;
		const isNearTie =
			hintIndex != null &&
			Number.isFinite(hintIndex) &&
			Math.abs(d2 - best.dist2) <= PROJECTION_TIE_DIST2_EPS;

		if (isClearlyCloser) {
			best = {
				index: i,
				t: proj.t,
				lat: proj.y,
				lng: proj.x,
				dist2: d2,
			};
			continue;
		}

		if (isNearTie) {
			const candidateHintDist = Math.abs(i - hintIndex);
			const bestHintDist = Math.abs(best.index - hintIndex);
			if (
				candidateHintDist < bestHintDist ||
				(candidateHintDist === bestHintDist && d2 < best.dist2)
			) {
				best = {
					index: i,
					t: proj.t,
					lat: proj.y,
					lng: proj.x,
					dist2: d2,
				};
			}
			continue;
		}

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
