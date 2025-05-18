import { getFilteredVehiclePositions } from "@/app/actions/filterVehicles";

export async function GET() {
	getFilteredVehiclePositions("177");
	return new Response("ok", {
		status: 200,
	});
}
