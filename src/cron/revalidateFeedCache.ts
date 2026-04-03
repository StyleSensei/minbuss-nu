/**
 * Tömmer Next edge-cache för feed-beroende API efter lyckad GTFS-import.
 */
export async function revalidateFeedCache(): Promise<void> {
	const siteUrl =
		process.env.REVALIDATE_SITE_URL
	const secret = process.env.REVALIDATE_SECRET;

	if (!siteUrl || !secret) {
		console.warn(
			"Skipping feed cache revalidation: set REVALIDATE_SECRET and REVALIDATE_SITE_URL.",
		);
		return;
	}

	const base = siteUrl.replace(/\/$/, "");
	const res = await fetch(`${base}/api/revalidate-feed`, {
		method: "POST",
		headers: { Authorization: `Bearer ${secret}` },
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`revalidate-feed failed: ${res.status} ${text}`);
	}
}
