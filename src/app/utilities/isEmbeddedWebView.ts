/** Inbäddad WebView (t.ex. WKWebView) — inte fristående Safari/Chrome. */
export function isEmbeddedWebView(): boolean {
	if (typeof navigator === "undefined") return false;

	const nav = navigator;
	const ua = nav.userAgent;

	// PWA på hemskärmen beter sig som Safari, inte inbäddad WebView.
	if ((nav as Navigator & { standalone?: boolean }).standalone) return false;

	const isIOS = /iPad|iPhone|iPod/.test(ua);
	if (isIOS) {
		const isStandaloneBrowser =
			(/Safari/.test(ua) &&
				!/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) ||
			/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
		return !isStandaloneBrowser;
	}

	if (/Android/.test(ua) && /\bwv\b/.test(ua)) return true;

	return false;
}
