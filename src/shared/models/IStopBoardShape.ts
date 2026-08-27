import type { IShapes } from "./IShapes";

export interface IStopBoardShape {
	route_short_name: string;
	route_type: number | null;
	shape_id: string;
	points: IShapes[];
}
