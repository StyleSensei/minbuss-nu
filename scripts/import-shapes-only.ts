/**
 * Engångs-/snabbimport: hämtar GTFS-zip per operatör men skriver bara shapes till databasen.
 * Använder GTFS_OPERATORS (samma som full import). Zip laddas fortfarande ned per operatör.
 *
 * Kör: npm run db:import-shapes
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const delayMs = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));

async function main() {
	const { extractZip } = await import("../src/cron/dataProcessors/extractZip");
	const { saveToDatabase } = await import("../src/cron/dataProcessors/saveToDatabase");
	const { getConfiguredOperators } = await import(
		"../src/shared/config/gtfsOperators"
	);

	const operators = getConfiguredOperators();
	const onlyShapes = { onlyFiles: ["shapes.txt"] as const };

	for (let i = 0; i < operators.length; i++) {
		const operator = operators[i];
		if (i > 0) {
			const raw = process.env.GTFS_IMPORT_DELAY_MS?.trim();
			const parsed = raw !== undefined && raw !== "" ? Number(raw) : NaN;
			const ms = Number.isFinite(parsed)
				? Math.max(0, parsed)
				: operators.length > 1
					? 7000
					: 0;
			if (ms > 0) {
				console.log(`Waiting ${ms}ms before next operator (rate limits)...`);
				await delayMs(ms);
			}
		}

		console.log(`Shapes import for operator: ${operator}`);
		const { shapes } = await extractZip(operator, onlyShapes);
		console.log(`  Parsed ${shapes.length} shape points`);
		await saveToDatabase(shapes, "shapes", operator);
	}

	console.log("Shapes-only import completed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
