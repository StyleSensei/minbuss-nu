export function normalizeTimeForDisplay(gtfsTime?: string): string | undefined {
	if (!gtfsTime) return undefined;

	const [hoursStr, minutesStr] = gtfsTime.split(":");
	let hours = Number.parseInt(hoursStr, 10);

	if (hours >= 24) {
		hours = hours % 24;
	}

	const formattedHours = hours.toString().padStart(2, "0");
	return `${formattedHours}:${minutesStr}`;
}
