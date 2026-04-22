/**
 * Tar bort alla primärnycklar på GTFS-tabellerna (oavsett namn: routes_pkey, calendar_dates_pk, …).
 * Gamla PK:er bygger ofta bara på GTFS-id och krockar mellan operatörer.
 * Unika index (operator, …) från db:ensure-indexes används av upsert.
 *
 * Kör: npm run db:fix-gtfs-pkeys
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const DROP_ALL_PKS_ON_TABLES = `
DO $$
DECLARE
	r record;
BEGIN
	FOR r IN
		SELECT c.conname AS name, c.conrelid::regclass AS tbl
		FROM pg_constraint c
		JOIN pg_class rel ON rel.oid = c.conrelid
		JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
		WHERE c.contype = 'p'
			AND nsp.nspname = 'public'
			AND rel.relname IN (
				'routes',
				'trips',
				'stops',
				'stop_times',
				'calendar_dates',
				'shapes'
			)
	LOOP
		EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I CASCADE', r.tbl, r.name);
	END LOOP;
END $$;
`;

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}

	const sql = postgres(process.env.DATABASE_URL);
	try {
		await sql.unsafe(DROP_ALL_PKS_ON_TABLES);
		console.log(
			"Dropped all primary keys on GTFS tables (public); unique (operator, …) indexes apply.",
		);
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
