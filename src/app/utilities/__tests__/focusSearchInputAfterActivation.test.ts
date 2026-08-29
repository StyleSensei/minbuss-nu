import { afterEach, describe, expect, it, vi } from "vitest";
import { focusSearchInputAfterActivation } from "../focusSearchInputAfterActivation";

describe("focusSearchInputAfterActivation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("focuses immediately on non-iOS when not already focused", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Windows NT 10.0)",
		});
		const focus = vi.fn();
		const input = { focus } as unknown as HTMLInputElement;
		vi.stubGlobal("document", { activeElement: null });

		focusSearchInputAfterActivation(input);
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	it("blur-refocuses on iOS after layout frames", () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
		});
		const blur = vi.fn();
		const focus = vi.fn();
		const setSelectionRange = vi.fn();
		const input = {
			value: "177",
			blur,
			focus,
			setSelectionRange,
		} as unknown as HTMLInputElement;
		vi.stubGlobal("document", { activeElement: input });
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});

		focusSearchInputAfterActivation(input);
		expect(blur).toHaveBeenCalled();
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(setSelectionRange).toHaveBeenCalledWith(3, 3);
	});
});
