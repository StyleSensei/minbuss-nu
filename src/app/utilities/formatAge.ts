export interface TimestampAge {
	seconds: number;
	minutes: number;
	hours?: number;
}

export const formatTimestampAge = (age: TimestampAge): string => {
	if (age.hours && age.hours > 0) {
		return `${age.hours}h ${age.minutes % 60}m ${age.seconds % 60}s`;
	}
	if (age.minutes > 0) {
		return `${age.minutes}m ${age.seconds % 60}s`;
	}
	return `${age.seconds}s`;
};
