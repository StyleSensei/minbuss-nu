import type { MutableRefObject } from "react";
import { Button } from "./Button";
import { zoomInIcon, zoomOutIcon } from "../../../public/icons";

interface ZoomButtonsProps {
	googleMapRef: MutableRefObject<google.maps.Map | null>;
	zoomIn: (GoogleMap: google.maps.Map) => void;
	zoomOut: (GoogleMap: google.maps.Map) => void;
}

export const ZoomButtons = ({
	googleMapRef,
	zoomIn,
	zoomOut,
}: ZoomButtonsProps) => {
	return (
		<div className="zoom-buttons">
			<Button
				className="--zoom"
				// title="Zooma in"
				path={zoomInIcon.pathD}
				pathFillRule1={zoomInIcon.pathFillRuleD1}
				pathFillRule2={zoomInIcon.pathFillRuleD2}
				fill="whitesmoke"
				onClick={() =>
					googleMapRef.current ? zoomIn(googleMapRef.current) : null
				}
			/>
			<Button
				className="--zoom"
				// title="Zooma ut"
				path={zoomOutIcon.pathD}
				pathFillRule1={zoomOutIcon.pathFillRuleD1}
				pathFillRule2={zoomOutIcon.pathFillRuleD2}
				fill="whitesmoke"
				onClick={() =>
					googleMapRef.current ? zoomOut(googleMapRef.current) : null
				}
			/>
		</div>
	);
};
