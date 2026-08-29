/** Static GTFS blobs (shapes, routes) — data uppdateras ~månadsvis via cron. */
export const STATIC_GTFS_CACHE_TTL_SEC = 60 * 60 * 24 * 30;

/** CDN/edge för per-stop shapes; Redis har längre TTL och nycklar med feed_version. */
export const STATIC_GTFS_EDGE_CACHE_SEC = 60 * 60 * 24;
