export function hasDisplayablePlatformCode(
	platformCode: string | null | undefined,
): boolean {
	const normalized = platformCode?.trim();
	return Boolean(normalized && !/^OLD\d*$/i.test(normalized));
}

export function shouldExpandStopBoardToStation(
	locationType: number | null | undefined,
	parentStation: string | null | undefined,
	platformCode: string | null | undefined,
): boolean {
	if ((locationType ?? 0) !== 0) return true;
	return Boolean(
		parentStation?.trim() && !hasDisplayablePlatformCode(platformCode),
	);
}
