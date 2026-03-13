export const get = async <T>(
	url: string,
	responseType: "json" | "arraybuffer" | "stream" = "json",
	options?: {
		revalidateSeconds?: number;
		signal?: AbortSignal;
		headers?: HeadersInit;
	},
): Promise<T> => {
	const res = await fetch(url, {
		method: "GET",
		headers: options?.headers,
		signal: options?.signal,
		// Enable Next.js data cache for server-side fetches.
		next:
			typeof options?.revalidateSeconds === "number"
				? { revalidate: options.revalidateSeconds }
				: undefined,
	});

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
