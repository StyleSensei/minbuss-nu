export function isIosSafari(): boolean {
	if (typeof navigator === "undefined") return false;
	return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Tvinga WebKit att rita om caret efter layoutflytt (anropas medan fokus redan är satt). */
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
				// type=search kan sakna setSelectionRange i vissa WebKit-versioner
			}
		});
	});
}
