import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { get } from "../../shared/services/serviceBase";

const gtfsZipUrl = (operator: string) =>
	`https://opendata.samtrafiken.se/gtfs/${operator}/${operator}.zip?key=${process.env.GTFS_REGIONAL_STATIC}`;

export type DownloadedGtfsZip = {
	createReadStream: () => Readable;
	cleanup: () => Promise<void>;
};

/**
 * Laddar ner hela GTFS-zip till en tempfil innan parsning.
 * Undviker att HTTP-anslutningen stängs medan DB-skrivningar pausar zip-strömmen.
 */
export async function downloadGtfsZip(
	operator: string,
): Promise<DownloadedGtfsZip> {
	const url = gtfsZipUrl(operator);
	const tempDir = await mkdtemp(join(tmpdir(), `gtfs-${operator}-`));
	const zipPath = join(tempDir, `${operator}.zip`);

	try {
		const body = await get<ReadableStream | null>(url, "stream");
		if (body == null) {
			throw new Error("GTFS zip response has no body");
		}

		await pipeline(Readable.fromWeb(body), createWriteStream(zipPath));

		const { size } = await stat(zipPath);
		console.log(
			`Downloaded GTFS zip for ${operator} (${(size / 1024 / 1024).toFixed(1)} MB)`,
		);

		return {
			createReadStream: () => createReadStream(zipPath),
			cleanup: () => rm(tempDir, { recursive: true, force: true }),
		};
	} catch (error) {
		await rm(tempDir, { recursive: true, force: true });
		console.error("Error downloading GTFS zip:", error);
		throw error;
	}
}

export async function withGtfsZip<T>(
	operator: string,
	process: (zip: Readable) => Promise<T>,
): Promise<T> {
	const downloaded = await downloadGtfsZip(operator);
	try {
		return await process(downloaded.createReadStream());
	} finally {
		await downloaded.cleanup();
	}
}
