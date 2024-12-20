"use server";
import { cache } from "react";
import { selectFromDatabase } from "./dataProcessors/selectFromDatabase";
import { getVehiclePositions } from "./dataSources/gtfsRealtime";

export const getCachedDbData = cache(selectFromDatabase);
export const getCachedVehiclePositions = cache(getVehiclePositions);
