import { isIosSafari } from "./syncIosInputCaret";

/** Fokusera sökfält efter att aktiv layout renderats — undviker iOS caret-offset. */
export function focusSearchInputAfterActivation(
	input: HTMLInputElement | null | undefined,
): void {
	if (!input) return;

	if (!isIosSafari()) {
		if (document.activeElement !== input) {
			input.focus({ preventScroll: true });
		}
		return;
	}

	const len = input.value.length;
	const refocus = () => {
		input.focus({ preventScroll: true });
		try {
			input.setSelectionRange(len, len);
		} catch {
			// type=search kan sakna setSelectionRange i vissa WebKit-versioner
		}
	};

	if (document.activeElement === input) {
		input.blur();
	}

	requestAnimationFrame(() => {
		requestAnimationFrame(refocus);
	});
}
