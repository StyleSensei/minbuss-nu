export function isIosSafari(): boolean {
	if (typeof navigator === "undefined") return false;
	return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** WebKit ritar caret på fel ställe när förfadern flyttas med transform — tvinga omritning. */
export function syncIosInputCaret(
	input: HTMLInputElement | null | undefined,
): void {
	if (!input || !isIosSafari()) return;
	if (document.activeElement !== input) return;

	const len = input.value.length;
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			if (document.activeElement !== input) return;
			try {
				input.setSelectionRange(len, len);
			} catch {
				input.blur();
				input.focus();
			}
		});
	});
}
