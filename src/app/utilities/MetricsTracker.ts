// Enkel utility för att spåra API-anrop och cacheanvändning

type MetricCounter = {
	apiCalls: number;
	redisCacheHits: number;
	redisCacheMisses: number;
	redisOperations: number;
	dbQueries: number;
	lastReset: number;
};

// Startläge för räknare
const metrics: MetricCounter = {
	apiCalls: 0,
	redisCacheHits: 0,
	redisCacheMisses: 0,
	redisOperations: 0,
	dbQueries: 0,
	lastReset: Date.now(),
};

// Aktivera/inaktivera loggning
let loggingEnabled = true;

// Funktion för att logga statistik periodiskt (var 60:e sekund)
setInterval(() => {
	if (!loggingEnabled) return;

	const now = Date.now();
	const timeSinceReset = (now - metrics.lastReset) / 1000;

	console.log("\n===== API OCH CACHE STATISTIK =====");
	console.log(`Tidsperiod: ${timeSinceReset.toFixed(1)} sekunder`);
	console.log(
		`API-anrop: ${metrics.apiCalls} (${((metrics.apiCalls / timeSinceReset) * 60).toFixed(1)} per minut)`,
	);
	console.log(`Redis cache träffar: ${metrics.redisCacheHits}`);
	console.log(`Redis cache missar: ${metrics.redisCacheMisses}`);
	console.log(`Databas-frågor: ${metrics.dbQueries}`);
	console.log(`Total Redis-operationer: ${metrics.redisOperations}`);

	if (metrics.redisCacheHits + metrics.redisCacheMisses > 0) {
		const hitRate = (
			(metrics.redisCacheHits /
				(metrics.redisCacheHits + metrics.redisCacheMisses)) *
			100
		).toFixed(1);
		console.log(`Cache hit rate: ${hitRate}%`);
	}

	console.log("=====================================\n");

	// Återställ räknare
	// biome-ignore lint/complexity/noForEach: <explanation>
	Object.keys(metrics).forEach((key) => {
		if (key !== "lastReset") {
			metrics[key as keyof Omit<MetricCounter, "lastReset">] = 0;
		}
	});
	metrics.lastReset = now;
}, 60000); // Var 60:e sekund

// API för att spåra anrop
export const MetricsTracker = {
	trackApiCall: () => {
		metrics.apiCalls++;
	},

	trackRedisOperation: () => {
		metrics.redisOperations++;
	},

	trackCacheHit: () => {
		metrics.redisCacheHits++;
		metrics.redisOperations++;
	},

	trackCacheMiss: () => {
		metrics.redisCacheMisses++;
		metrics.redisOperations++;
	},

	trackDbQuery: () => {
		metrics.dbQueries++;
	},

	enableLogging: (enabled: boolean) => {
		loggingEnabled = enabled;
	},
};
