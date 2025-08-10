export function convertGTFSTimeToDate(gtfsTime: string): Date {
	const [hoursStr, minutes, seconds] = gtfsTime.split(":");
	let hours = Number.parseInt(hoursStr, 10);

	const now = new Date();
	const currentHour = now.getHours();
	const date = new Date();

	if (hours >= 24) {
		if (currentHour < 4) {
			hours = hours % 24;
		} else {
			date.setDate(date.getDate() + 1);
			hours = hours % 24;
		}
	} else if (currentHour < 4 && hours >= 22 && hours < 24) {
		date.setDate(date.getDate() - 1);
	} else if (currentHour >= 15 && hours < 6) {
		date.setDate(date.getDate() + 1);
	}

	date.setHours(
		hours,
		Number.parseInt(minutes, 10),
		seconds ? Number.parseInt(seconds, 10) : 0,
	);

	return date;
}
