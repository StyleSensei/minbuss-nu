type DeviceOrientationEventWithWebkit = DeviceOrientationEvent & {
	webkitCompassHeading?: number;
};

/** iOS 13+ kräver explicit tillstånd via användargest. */
export function needsDeviceOrientationPermission(): boolean {
	return (
		typeof DeviceOrientationEvent !== "undefined" &&
		typeof (
			DeviceOrientationEvent as unknown as {
				requestPermission?: () => Promise<PermissionState>;
			}
		).requestPermission === "function"
	);
}

export async function requestDeviceOrientationPermission(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (typeof DeviceOrientationEvent === "undefined") return false;

	const requestPermission = (
		DeviceOrientationEvent as unknown as {
			requestPermission?: () => Promise<PermissionState>;
		}
	).requestPermission;

	if (typeof requestPermission === "function") {
		try {
			const state = await requestPermission();
			return state === "granted";
		} catch {
			return false;
		}
	}

	return true;
}

/** Plockar ut kompassriktning (0 = norr, medsols) från en orienteringshändelse. */
export function getCompassHeadingFromEvent(
	event: DeviceOrientationEvent,
): number | null {
	const webkitHeading = (event as DeviceOrientationEventWithWebkit)
		.webkitCompassHeading;
	if (webkitHeading != null && Number.isFinite(webkitHeading)) {
		return webkitHeading;
	}

	if (event.alpha == null || !Number.isFinite(event.alpha)) {
		return null;
	}

	// Absolut orientering: alpha är kompass mot true north.
	if (event.absolute) {
		return event.alpha;
	}

	// Vissa Android-enheter saknar absolute men alpha följer ändå kompassen.
	return (360 - event.alpha) % 360;
}

type CompassListener = (heading: number) => void;

let listening = false;
let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
const listeners = new Set<CompassListener>();

function dispatchCompassHeading(event: DeviceOrientationEvent) {
	const heading = getCompassHeadingFromEvent(event);
	if (heading == null) return;
	for (const listener of listeners) {
		listener(heading);
	}
}

function startCompassListening(): void {
	if (typeof window === "undefined" || listening) return;

	orientationHandler = (event: DeviceOrientationEvent) => {
		dispatchCompassHeading(event);
	};

	window.addEventListener("deviceorientationabsolute", orientationHandler);
	window.addEventListener("deviceorientation", orientationHandler);
	listening = true;
}

/** Anropa direkt från klick/pointerdown — iOS kräver synkront requestPermission()-anrop. */
export function enableDeviceCompassFromUserGesture(): void {
	if (typeof window === "undefined" || listening) return;

	if (!needsDeviceOrientationPermission()) {
		startCompassListening();
		return;
	}

	const requestPermission = (
		DeviceOrientationEvent as unknown as {
		 requestPermission?: () => Promise<PermissionState>;
		}
	).requestPermission;

	if (typeof requestPermission !== "function") {
		startCompassListening();
		return;
	}

	requestPermission()
		.then((state) => {
			if (state === "granted") {
				startCompassListening();
			}
		})
		.catch(() => {});
}

/** Startar kompasslyssnare efter ev. iOS-tillstånd. Idempotent. */
export async function ensureDeviceCompassListening(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (listening) return true;

	const granted = await requestDeviceOrientationPermission();
	if (!granted) return false;

	startCompassListening();
	return true;
}

type SubscribeDeviceCompassOptions = {
	/** Startar kompasslyssnare direkt. Default false på iOS (kräver användargest). */
	autoStart?: boolean;
};

export function subscribeDeviceCompass(
	listener: CompassListener,
	options: SubscribeDeviceCompassOptions = {},
): () => void {
	listeners.add(listener);
	const autoStart = options.autoStart ?? !needsDeviceOrientationPermission();
	if (autoStart) {
		void ensureDeviceCompassListening();
	}

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && listening && orientationHandler) {
			window.removeEventListener(
				"deviceorientationabsolute",
				orientationHandler,
			);
			window.removeEventListener("deviceorientation", orientationHandler);
			orientationHandler = null;
			listening = false;
		}
	};
}
