import { useEffect } from "react";

export function useFollowBusBorderClass(
	followBus: boolean,
	vehicleCount: number,
) {
	useEffect(() => {
		const main = document.getElementById("follow-bus-border");
		if (followBus && vehicleCount > 0) {
			main?.classList.add("follow-bus-active");
		} else {
			main?.classList.remove("follow-bus-active");
		}
		return () => {
			main?.classList.remove("follow-bus-active");
		};
	}, [followBus, vehicleCount]);
}
