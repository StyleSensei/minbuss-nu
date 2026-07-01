import type { Entry } from "unzipper";
import csvParser from "csv-parser";

export type CsvRow = Record<string, string>;

const parseEntry = (
	entry: Entry,
	onRow: (row: CsvRow) => void,
): Promise<void> =>
	new Promise((resolve, reject) => {
		entry
			.pipe(csvParser())
			.on("data", onRow)
			.on("end", resolve)
			.on("error", reject);
	});

export const parseEntryAsArray = async (entry: Entry): Promise<CsvRow[]> => {
	const rows: CsvRow[] = [];
	await parseEntry(entry, (row) => {
		rows.push(row);
	});
	return rows;
};

export const parseEntryInBatches = async (
	entry: Entry,
	batchSize: number,
	onBatch: (batch: CsvRow[]) => Promise<void>,
): Promise<void> => {
	let batch: CsvRow[] = [];

	await new Promise<void>((resolve, reject) => {
		let pending = Promise.resolve();

		const stream = entry.pipe(csvParser());

		const flushBatch = (rows: CsvRow[]) => {
			stream.pause();
			pending = pending
				.then(() => onBatch(rows))
				.then(() => {
					stream.resume();
				})
				.catch(reject);
		};

		stream
			.on("data", (row: CsvRow) => {
				batch.push(row);
				if (batch.length >= batchSize) {
					const toProcess = batch;
					batch = [];
					flushBatch(toProcess);
				}
			})
			.on("end", () => {
				pending
					.then(async () => {
						if (batch.length > 0) {
							await onBatch(batch);
							batch = [];
						}
						resolve();
					})
					.catch(reject);
			})
			.on("error", reject);
	});
};
