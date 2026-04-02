import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { get } from "../../shared/services/serviceBase";

export async function getStaticData(): Promise<Readable> {
	const url = `https://opendata.samtrafiken.se/gtfs/sl/sl.zip?key=${process.env.GTFS_REGIONAL_STATIC}`;
	try {
		const body = await get<ReadableStream | null>(url, "stream");
		if (body == null) {
			throw new Error("GTFS zip response has no body");
		}
		// fetch() returns a Web ReadableStream; unzipper/csv-parser need Node streams.
		return Readable.fromWeb(body);
	} catch (error) {
		console.error("Error fetching zip file:", error);
		throw error;
	}
}
