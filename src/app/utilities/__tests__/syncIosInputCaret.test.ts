import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosSafari, syncIosInputCaret } from "../syncIosInputCaret";

describe("isIosSafari", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns true for iPhone user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
		});
		expect(isIosSafari()).toBe(true);
	});

	it("returns false for other browsers", () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile",
		});
		expect(isIosSafari()).toBe(false);
	});
});

describe("syncIosInputCaret", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("does nothing on non-iOS", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Windows NT 10.0)",
		});
		const setSelectionRange = vi.fn();
		syncIosInputCaret({ setSelectionRange } as unknown as HTMLInputElement);
		expect(setSelectionRange).not.toHaveBeenCalled();
	});

	it("schedules setSelectionRange when focused on iOS", async () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
		});
		const setSelectionRange = vi.fn();
		const input = {
			value: "177",
			setSelectionRange,
			blur: vi.fn(),
			focus: vi.fn(),
		} as unknown as HTMLInputElement;
		vi.stubGlobal("document", { activeElement: input });
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});

		syncIosInputCaret(input);
		expect(setSelectionRange).toHaveBeenCalledWith(3, 3);
	});
});
