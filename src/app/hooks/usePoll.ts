import { useCallback, useRef } from "react";

interface ResponseWithData<T> {
	data: T[];
	error?: {
		type: string;
		message: string;
	};
}

export const usePoll = <T>(
	setState: (data: T[]) => void,
	funcToPoll: (query: string) => Promise<ResponseWithData<T>>,
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
				setState(response.data);
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
