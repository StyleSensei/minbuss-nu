export interface ICalendarDates {
	service_id: number;
	date: number; // YYYYMMDD
	exception_type: 1 | 2; // 1 for added service, 2 for removed service
}
