export function debounce(cb: (query: string) => void, delay = 250) {
	let timeout: NodeJS.Timeout;

	return (...args: [string]) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			cb(...args);
		}, delay);
	};
}
