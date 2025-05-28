import type { Readable } from "node:stream";
import { get } from "../serviceBase";

export async function getStaticData() {
	const url = `https://opendata.samtrafiken.se/gtfs/sl/sl.zip?key=${process.env.GTFS_REGIONAL_STATIC}`;
	try {
		const response = await get<Readable>(url, "stream");
		return response;
	} catch (error) {
		console.error("Error fetching zip file:", error);
		throw error;
	}
}
