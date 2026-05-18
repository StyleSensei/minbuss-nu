import { searchPathForOperator } from "../../paths";
import type { IUser } from "../../hooks/useUserPosition";

/** Centrera kartan på GPS bara när URL-region matchar var användaren befinner sig (eller focusUser). */
export function shouldCenterMapOnUserPosition(
	focusUserParam: boolean,
	userPosition: IUser | null,
	mapOperatorForView: string,
	findOperatorForPosition: (lat: number, lng: number) => string | null,
): boolean {
	if (focusUserParam) return true;
	if (!userPosition) return false;
	const matched = findOperatorForPosition(userPosition.lat, userPosition.lng);
	return matched === mapOperatorForView;
}

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
