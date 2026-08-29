import { afterEach, describe, expect, it } from "vitest";
import { isEmbeddedWebView } from "../isEmbeddedWebView";

describe("isEmbeddedWebView", () => {
	const originalNavigator = globalThis.navigator;

	afterEach(() => {
		Object.defineProperty(globalThis, "navigator", {
			value: originalNavigator,
			configurable: true,
		});
	});

	it("returns false for desktop Safari", () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent:
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			},
			configurable: true,
		});

		expect(isEmbeddedWebView()).toBe(false);
	});

	it("returns false for iOS Safari", () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
				standalone: false,
			},
			configurable: true,
		});

		expect(isEmbeddedWebView()).toBe(false);
	});

	it("returns true for iOS WKWebView without Safari token", () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
				standalone: false,
			},
			configurable: true,
		});

		expect(isEmbeddedWebView()).toBe(true);
	});

	it("returns false for iOS home-screen PWA", () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
				standalone: true,
			},
			configurable: true,
		});

		expect(isEmbeddedWebView()).toBe(false);
	});

	it("returns true for Android WebView", () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent:
					"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.0.0 Mobile Safari/537.36 wv",
			},
			configurable: true,
		});

		expect(isEmbeddedWebView()).toBe(true);
	});
});
