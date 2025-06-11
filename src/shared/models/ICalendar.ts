export interface ICalendar {
	service_id: number;
	monday: boolean;
	tuesday: boolean;
	wednesday: boolean;
	thursday: boolean;
	friday: boolean;
	saturday: boolean;
	sunday: boolean;
	start_date: number; // YYYYMMDD
	end_date: number; // YYYYMMDD
}
