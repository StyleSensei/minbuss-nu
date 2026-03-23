import { NextResponse, type NextRequest } from "next/server";
import {
    getCachedVehiclePositions,
    getCachedDbData,
    getCachedShapesData,
} from "@/app/services/cacheHelper";
import type { IVehiclePosition } from "@shared/models/IVehiclePosition";
import type { ITripData } from "@/app/context/DataContext";

export const revalidate = 2;

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ busline: string }> }
) {
    const { busline } = await context.params;

    if (!busline) {
        return NextResponse.json(
            { error: { type: "OTHER", message: "Missing busline parameter" } },
            { status: 400 }
        );
    }

    try {
        const cachedVehiclePositions = await getCachedVehiclePositions();

        const activeTrips = new Set(
            cachedVehiclePositions.data
                .filter((vehicle) => vehicle?.trip?.tripId)
                .map((vehicle) => vehicle.trip.tripId)
        );

        if (activeTrips.size === 0) {
            return NextResponse.json(
                { data: [], error: cachedVehiclePositions.error },
                {
                    headers: {
                        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
                    },
                }
            );
        }

        const cachedDbData = (await getCachedDbData(busline)) as ITripData;
        const tripById = new Map(
            cachedDbData.currentTrips
                .filter((trip) => trip?.trip_id)
                .map((trip) => [trip.trip_id, trip] as const)
        );

        let filteredData = cachedVehiclePositions.data.filter((vehicle) => {
            if (!vehicle?.trip?.tripId) return false;
            return tripById.has(vehicle.trip.tripId);
        });

        filteredData.sort((a, b) =>
            (a.trip?.tripId || "").localeCompare(b.trip?.tripId || "")
        );

        const vehiclesWithShapes: IVehiclePosition[] = await Promise.all(
            filteredData.map(async (vehicle) => {
                const tripId = vehicle?.trip?.tripId;
                if (!tripId) return vehicle;
                const matchingTrip = tripById.get(tripId);

                if (matchingTrip?.shape_id) {
                    const shapePoints = await getCachedShapesData(
                        matchingTrip.feed_version,
                        matchingTrip.shape_id
                    );
                    return { ...vehicle, shapePoints } as IVehiclePosition;
                }
                return vehicle;
            })
        );

        let vehicleError = cachedVehiclePositions.error;

        return NextResponse.json(
            { data: vehiclesWithShapes, error: vehicleError },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
                },
            }
        );
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        return NextResponse.json(
            {
                data: [],
                error: {
                    type: "OTHER",
                    message: "Ett fel uppstod vid hämtning av fordonsdata",
                },
            },
            { status: 500 }
        );
    }
}