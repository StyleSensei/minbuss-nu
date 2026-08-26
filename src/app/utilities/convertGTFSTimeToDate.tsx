export function convertGTFSTimeToDate(
	gtfsTime: string,
	now = new Date(),
): Date {
	const [hoursStr, minutes, seconds] = gtfsTime.split(":");
	const hours = Number.parseInt(hoursStr, 10);
	const minute = Number.parseInt(minutes, 10);
	const second = seconds ? Number.parseInt(seconds, 10) : 0;
	const candidates = [-1, 0, 1].map((serviceDayOffset) => {
		const date = new Date(now);
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() + serviceDayOffset);
		date.setMinutes(hours * 60 + minute, second, 0);
		return date;
	});
	const graceMs = 15 * 60 * 1000;
	const upcoming = candidates
		.filter((date) => date.getTime() >= now.getTime() - graceMs)
		.sort(
			(a, b) =>
				Math.abs(a.getTime() - now.getTime()) -
				Math.abs(b.getTime() - now.getTime()),
		);

	return (
		upcoming[0] ??
		candidates.sort(
			(a, b) =>
				Math.abs(a.getTime() - now.getTime()) -
				Math.abs(b.getTime() - now.getTime()),
		)[0] ??
		new Date(Number.NaN)
	);
}
