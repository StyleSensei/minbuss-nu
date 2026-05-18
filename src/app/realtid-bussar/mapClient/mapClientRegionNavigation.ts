import { searchPathForOperator } from "../../paths";

/** Samma URL som vid klick på "Min position" när GPS ligger i annan region. */
export function hrefForOperatorAtUserPosition(
	matchedOperator: string,
	searchParams: URLSearchParams | { toString(): string },
): string {
	const p = new URLSearchParams(searchParams.toString());
	p.delete("operator");
	p.set("focusUser", "1");
	const qs = p.toString();
	const base = searchPathForOperator(matchedOperator);
	return qs ? `${base}?${qs}` : base;
}
