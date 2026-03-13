interface ITimestampAge {
	seconds: number;
	minutes: number;
	hours?: number;
}

// Define specific error types with their unique properties
interface IBaseError {
	message: string;
}

interface IDataTooOldError extends IBaseError {
	type: "DATA_TOO_OLD";
	timestampAge: ITimestampAge;
	isStale?: boolean;
	message: string;
}

interface IApiError extends IBaseError {
	type: "API_ERROR";
}

interface IParsingError extends IBaseError {
	type: "PARSING_ERROR";
}

interface IOtherError extends IBaseError {
	type: "OTHER";
}

// Use a union type for all possible errors
export type VehicleError =
	| IDataTooOldError
	| IApiError
	| IParsingError
	| IOtherError;

