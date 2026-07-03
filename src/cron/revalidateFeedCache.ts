/**
 * Tömmer Next edge-cache för feed-beroende API efter lyckad GTFS-import.
 * Returnerar false vid fel — importen ska inte misslyckas p.g.a. cache-revalidering.
 */
export async function revalidateFeedCache(): Promise<boolean> {
	const siteUrl = process.env.REVALIDATE_SITE_URL?.trim();
	const secret = process.env.REVALIDATE_SECRET?.trim();

	if (!siteUrl || !secret) {
		console.warn(
			"Skipping feed cache revalidation: set REVALIDATE_SECRET and REVALIDATE_SITE_URL.",
		);
		return false;
	}

	const base = siteUrl.replace(/\/$/, "");

	try {
		const res = await fetch(`${base}/api/revalidate-feed`, {
			method: "POST",
			headers: { Authorization: `Bearer ${secret}` },
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			console.error(`Feed cache revalidation failed: ${res.status} ${text}`);
			console.error(
				"Check that GitHub Actions REVALIDATE_SECRET matches Vercel production REVALIDATE_SECRET, and REVALIDATE_SITE_URL is the production URL.",
			);
			return false;
		}

		console.log("Feed API cache revalidated successfully.");
		return true;
	} catch (error) {
		console.error("Feed cache revalidation failed:", error);
		return false;
	}
}
