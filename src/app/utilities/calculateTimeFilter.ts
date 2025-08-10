import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export enum TimeThresholds {
	THIRTY_MIN_BEFORE_MIDNIGHT = 23 * 60 + 30,
	MIDNIGHT = 24 * 60,
}

interface TimeFilterParams {
	minutesFilter: SQL;
	startTimeMinutes: number;
	endTimeMinutes: number;
	isEarlyMorning: boolean;
}

export function calculateTimeFilter({
	minutesFilter,
	startTimeMinutes,
	endTimeMinutes,
	isEarlyMorning,
}: TimeFilterParams): SQL {
	if (isEarlyMorning) {
		// For 00:00-03:59, show departures from 23:30 and 24:00+ times
		return sql`(
	    (${minutesFilter} >= ${TimeThresholds.THIRTY_MIN_BEFORE_MIDNIGHT})
	    OR
	    (${minutesFilter} >= ${TimeThresholds.MIDNIGHT} AND ${minutesFilter} <= ${endTimeMinutes})
	  )`;
	}
	return sql`(
      ${minutesFilter} >= ${startTimeMinutes}
      AND
      ${minutesFilter} <= ${endTimeMinutes}
    )`;
}

/**
 * Converts time from GTFS format to minutes after midnight
 *
 * @param columnRef - The column reference for departure_time in SQL
 * @returns SQL expression to convert GTFS time to minutes
 */
export function createMinutesFilter(columnRef: PgColumn): SQL {
	return sql`(
    (
      CAST(SPLIT_PART(${columnRef}, ':', 1) AS INTEGER) * 60 + 
      CAST(SPLIT_PART(${columnRef}, ':', 2) AS INTEGER)
    )
  )`;
}
