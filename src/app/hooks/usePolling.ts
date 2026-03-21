import { useCallback, useRef } from "react";
import type { IError } from "@/app/services/cacheHelper";

export interface ResponseWithData<T, E = IError> {
	data: T[];
	error?: E;
}

export function usePolling<T>(
	fetchFn: (query: string, signal?: AbortSignal) => Promise<T>,
	onData: (data: T) => void,
	intervalMs: number,
	options?: {
		onError?: (error: unknown) => void;
	},
) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const queryRef = useRef<string>("");

	const executeFetch = useCallback(async () => {
		if (!queryRef.current) return;

		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();

		try {
			const data = await fetchFn(
				queryRef.current,
				abortControllerRef.current.signal,
			);
			onData(data);
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}
			options?.onError?.(error);
		}
	}, [fetchFn, onData, options?.onError]);

	const startPolling = useCallback(
		(query: string) => {
			queryRef.current = query;
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			void executeFetch();
			intervalRef.current = setInterval(executeFetch, intervalMs);
		},
		[executeFetch, intervalMs],
	);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		queryRef.current = "";
	}, []);

	return { startPolling, stopPolling };
}
