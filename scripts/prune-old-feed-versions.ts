/**
 * Tar bort GTFS-rader där feed_version skiljer sig från senaste importen i respektive tabell.
 * Senaste version per tabell = MAX(feed_version) för operatören i den tabellen (samma mönster
 * som vid upsert: rader som inte finns i senaste zippen behåller gammal feed_version).
 *
 * Per-tabell-MAX gör att en shapes-only-import (nya shapes, gamla trips) inte raderar nya shapes.
 *
 * Kräver DATABASE_URL (.env.local / .env).
 *
 * Kör: npm run db:prune-old-feeds
 * Torrkörning: npm run db:prune-old-feeds -- --dry-run
 * En operatör: npm run db:prune-old-feeds -- --operator sl
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { getConfiguredOperators } from "../src/shared/config/gtfsOperators";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

/** Tabellnamn som har kolumnen feed_version (whitelist för sql.unsafe). */
const FEED_TABLES = [
	"stop_times",
	"trips",
	"routes",
	"stops",
	"calendar_dates",
	"shapes",
] as const;

type FeedTable = (typeof FEED_TABLES)[number];

function parseArgs() {
	const argv = process.argv.slice(2);
	const dryRun = argv.includes("--dry-run");
	let operator: string | undefined;
	const opIdx = argv.indexOf("--operator");
	if (opIdx !== -1 && argv[opIdx + 1]) {
		operator = argv[opIdx + 1].trim().toLowerCase();
	}
	return { dryRun, operator };
}

async function maxFeedVersionForTable(
	sql: postgres.Sql,
	table: FeedTable,
	operator: string,
): Promise<string | null> {
	const rows = await sql.unsafe<{ max: string | null }[]>(
		`SELECT MAX(feed_version)::text AS max FROM ${table} WHERE operator = $1`,
		[operator],
	);
	return rows[0]?.max ?? null;
}

async function countStaleRows(
	sql: postgres.Sql,
	table: FeedTable,
	operator: string,
	latest: string,
): Promise<number> {
	const rows = await sql.unsafe<{ c: string }[]>(
		`SELECT COUNT(*)::text AS c FROM ${table}
     WHERE operator = $1 AND feed_version IS DISTINCT FROM $2::date`,
		[operator, latest],
	);
	return Number(rows[0]?.c ?? 0);
}

async function deleteStaleRows(
	sql: postgres.Sql,
	table: FeedTable,
	operator: string,
	latest: string,
): Promise<number> {
	const result = await sql.unsafe(
		`DELETE FROM ${table}
     WHERE operator = $1 AND feed_version IS DISTINCT FROM $2::date`,
		[operator, latest],
	);
	return result.count;
}

async function main() {
	const { dryRun, operator: operatorArg } = parseArgs();

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}

	const operators = operatorArg ? [operatorArg] : getConfiguredOperators();

	const sql = postgres(process.env.DATABASE_URL);

	try {
		for (const operator of operators) {
			console.log(`\n--- operator: ${operator} ---`);
			for (const table of FEED_TABLES) {
				const latest = await maxFeedVersionForTable(sql, table, operator);
				if (latest === null) {
					console.log(`${table}: inga rader, hoppar över`);
					continue;
				}

				const stale = await countStaleRows(sql, table, operator, latest);
				if (stale === 0) {
					console.log(
						`${table}: alla rader har feed_version=${latest} (${dryRun ? "dry-run" : "ok"})`,
					);
					continue;
				}

				if (dryRun) {
					console.log(
						`${table}: skulle radera ${stale} rader (behåller feed_version=${latest})`,
					);
					continue;
				}

				const deleted = await deleteStaleRows(sql, table, operator, latest);
				console.log(
					`${table}: raderade ${deleted} rader (senaste feed_version=${latest})`,
				);
			}
		}

		if (dryRun) {
			console.log("\nTorrkörning klar (inga rader raderades).");
		} else {
			console.log("\nRensning klar.");
		}
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
