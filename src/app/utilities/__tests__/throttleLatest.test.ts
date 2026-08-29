import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttleLatest } from "../throttleLatest";

describe("throttleLatest", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("kör direkt första gången och sedan med throttle", () => {
		const fn = vi.fn();
		const throttled = throttleLatest(fn, 100);

		throttled(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenLastCalledWith(1);

		throttled(2);
		throttled(3);
		expect(fn).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith(3);
	});
});
