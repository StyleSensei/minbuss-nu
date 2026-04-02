export const get = async <T>(
	url: string,
	responseType: "json" | "arraybuffer" | "stream" = "json",
	options?: {
		revalidateSeconds?: number;
		signal?: AbortSignal;
		headers?: HeadersInit;
	},
): Promise<T> => {
	// `next` is a Next.js extension to fetch; standard RequestInit omits it (e.g. cron tsc).
	const res = await fetch(url, {
		method: "GET",
		headers: options?.headers,
		signal: options?.signal,
		...(typeof options?.revalidateSeconds === "number"
			? { next: { revalidate: options.revalidateSeconds } }
			: {}),
	} as RequestInit);

	if (!res.ok) {
		throw new Error(`Request failed: ${res.status} ${res.statusText}`);
	}

	if (responseType === "arraybuffer") {
		return (await res.arrayBuffer()) as T;
	}

	if (responseType === "stream") {
		return res.body as T;
	}

	return (await res.json()) as T;
};
