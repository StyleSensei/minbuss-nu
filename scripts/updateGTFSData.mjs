import { updateGTFSData } from "../dist-cron/src/cron/updateGTFS.js";

updateGTFSData()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Failed to update GTFS data:", error);
		process.exit(1);
	});
