/** Lägger till `operator` som query-param om strängen är icke-tom. */
export function appendOperatorToApiUrl(
	pathWithQuery: string,
	operator: string,
): string {
	const trimmed = operator.trim();
	if (!trimmed) return pathWithQuery;
	const sep = pathWithQuery.includes("?") ? "&" : "?";
	return `${pathWithQuery}${sep}operator=${encodeURIComponent(trimmed)}`;
}
