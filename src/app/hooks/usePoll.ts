import { useCallback, useRef } from "react";

export const usePoll = <T>(
	setState: (data: T[]) => void,
	funcToPoll: (query: string) => Promise<T[]>,
	intervalMs: number,
) => {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const pollOnInterval = useCallback(
		(query: string) => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			intervalRef.current = setInterval(async () => {
				setState(await funcToPoll(query));
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
