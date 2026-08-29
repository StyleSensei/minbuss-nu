/** Kör fn med senaste värdet, högst en gång per ms (trailing throttle). */
export function throttleLatest<T>(
	fn: (value: T) => void,
	ms: number,
): (value: T) => void {
	let lastCall = 0;
	let pending: T | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const flush = () => {
		if (pending == null) return;
		lastCall = Date.now();
		const value = pending;
		pending = null;
		timer = null;
		fn(value);
	};

	return (value: T) => {
		pending = value;
		const elapsed = Date.now() - lastCall;

		if (elapsed >= ms) {
			if (timer != null) {
				clearTimeout(timer);
				timer = null;
			}
			flush();
			return;
		}

		if (timer == null) {
			timer = setTimeout(flush, ms - elapsed);
		}
	};
}
