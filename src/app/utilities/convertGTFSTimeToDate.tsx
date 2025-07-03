// Hjälpfunktion för att konvertera GTFS-tid till JavaScript Date
export function convertGTFSTimeToDate(gtfsTime: string): Date {
	const [hoursStr, minutesStr] = gtfsTime.split(":");
	const hours = Number.parseInt(hoursStr, 10);
	const minutes = Number.parseInt(minutesStr, 10);

	const date = new Date();
	// Använd alltid normaliserad timme (0-23) för setHours
	date.setHours(hours % 24);
	date.setMinutes(minutes);
	date.setSeconds(0);

	// Om ursprungliga timmar var ≥ 24, lägg till motsvarande antal dagar
	if (hours >= 24) {
		date.setDate(date.getDate() + Math.floor(hours / 24));
	}

	return date;
}
