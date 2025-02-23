"use server";
import { cache } from "react";
import { selectFromDatabase } from "./dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "./dataSources/gtfsRealtime";
import { getTripUpdates } from "./dataSources/gtfsTripUpdates";

export const getCachedDbData = cache(selectFromDatabase);
export const getCachedVehiclePositions = cache(getVehiclePositions);
export const getCachedTripUpdates = cache(getTripUpdates);
