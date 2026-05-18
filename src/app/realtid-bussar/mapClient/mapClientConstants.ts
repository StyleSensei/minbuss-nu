/**
 * All map camera-driven React state (stops viewport, zoom thresholds, preview) updates via this debounce
 * so we do not re-render the full map subtree on every Maps camera frame.
 */
export const MAP_VIEWPORT_DEBOUNCE_MS = 320;
/** Extra marginal runt kartans synliga ruta innan hållplatser hämtas (mindre payload än hela stops-positions.json). */
export const MAP_STOPS_BOUNDS_EXPAND_RATIO = 0.4;
/**
 * Efter viewport-debounce kan bounds ändras i snabb följd; utan detta avbryts fetch (AbortError)
 * innan servern hunnit svara. Vänta tills rutan legat still innan /api/stops/positions.
 */
export const MAP_STOPS_POSITIONS_FETCH_DEBOUNCE_MS = 450;

/** Utzoomad start när ingen linje är vald — efter första idle zoomar vi in (löser sporadiska svarta rutor / att lager inte hinner med förrän man zoomar manuellt). */
export const MAP_BOOTSTRAP_ZOOM = 11;
export const MAP_TARGET_INITIAL_ZOOM = 14;
/** Minsta tid efter första `tilesloaded` innan spinner får släckas (workers hinner starta). */
export const MAP_VECTOR_PAINT_POST_TILES_MIN_MS = 1400;
/** Därtill: inget nytt `idle` på minst denna ruta (sista vektorbatchen). */
export const MAP_VECTOR_PAINT_IDLE_DEBOUNCE_MS = 560;

/**
 * Överlever unmount när man lämnar kartrouten (samma flik) så vi inte zoomar ut/in igen vid SPA-tillbaknavigation.
 * Nollställs vid full sidladdning.
 */
export const mapBootstrapZoomTabState = { doneInTab: false };

/** Max en full sidomladdning per “fastnad”-episod; nollställs när kartan blivit klar. */
export const MAP_BOOT_HARD_RELOAD_COUNT_KEY = "mapBootHardReloadCount";

/** Auto-redirect till GPS-region körs bara en gång per flik (manuellt regionsbyte ska inte overridas). */
export const MAP_GEO_REGION_AUTO_REDIRECT_DONE_KEY =
	"mapGeoRegionAutoRedirectDone";

export const LINE_SHAPE_FIT_PADDING = 56;
export const LINE_SHAPE_FIT_MAX_ZOOM = 16;
