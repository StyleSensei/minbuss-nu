"use server";

import { selectAllroutes } from "../services/dataProcessors/selectAllRoutes";

export const getAllRoutes = async () => {
	const data = await selectAllroutes();
	const allRoutes = data
		.map((route) => route.line)
		.filter((route) => route !== null);
	console.log("all routes has been fetched");
	return allRoutes;
};
