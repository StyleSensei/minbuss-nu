"use server";

import { selectAllroutes } from "../services/dataProcessors/selectAllRoutes";

export const getAllRoutes = async () => {
	const data = await selectAllroutes();
	const routesArray = data
		.map((route) => route.line)
		.filter((route) => route !== null);

	const routesObject: Record<string, boolean> = {};
	for (const route of routesArray) {
		routesObject[route] = true;
	}

	return {
		asObject: routesObject,
		asArray: routesArray,
	};
};
