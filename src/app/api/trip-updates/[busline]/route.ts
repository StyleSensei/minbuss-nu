import { NextResponse, type NextRequest } from "next/server";
import { getCachedDbData, getCachedTripUpdates } from "@/app/services/cacheHelper";
import type { ITripUpdate } from "@/shared/models/ITripUpdate";

export const revalidate = 20; // Cache i 20 sekunder

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ busline: string }> }
) {
    const { busline } = await context.params;

    if (!busline) {
        return NextResponse.json(
            { error: "Missing busline parameter" },
            { status: 400 }
        );
    }

    try {
       const cachedTripUpdates = await getCachedTripUpdates();
        let filteredData: ITripUpdate[] = [];
       
        const cachedDbData = await getCachedDbData(busline);
        filteredData = cachedTripUpdates?.filter((vehicle) =>
            cachedDbData.currentTrips.some(
                (trip) => trip?.trip_id === vehicle?.trip?.tripId,
            ),
        );
       
        return NextResponse.json(
            { data: filteredData },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=20, stale-while-revalidate=30",
                },
            }
        );
    } catch (error) {
        console.error("Error fetching trip updates:", error);
        return NextResponse.json(
            { error: "Failed to fetch trip updates" },
            { status: 500 }
        );
    }
}