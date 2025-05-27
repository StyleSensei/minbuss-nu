import { useCallback, useRef } from "react";
import type { IError } from "../services/cacheHelper";

export interface ResponseWithData<T, E = IError> {
	data: T[];
	error?: E;
}

// Make the setState parameter accept either arrays or objects with data property
export const usePoll = <T, E = IError>(
	setState:
		| ((data: T[]) => void)
		| ((response: ResponseWithData<T, E>) => void),
	funcToPoll: (query: string) => Promise<ResponseWithData<T, E>>,
	intervalMs: number,
) => {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const pollOnInterval = useCallback(
		(query: string) => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			intervalRef.current = setInterval(async () => {
				const response = await funcToPoll(query);

				// Pass the entire response object to setState
				// TypeScript will handle whether it expects just the array or the whole object
				(setState as (response: ResponseWithData<T, E>) => void)(response);
			}, intervalMs);
		},
		[setState, funcToPoll, intervalMs],
	);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	return { pollOnInterval, stopPolling };
};
