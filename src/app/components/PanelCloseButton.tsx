"use client";

import { close } from "public/icons";
import { Icon } from "./Icon";

interface PanelCloseButtonProps {
	onClose: () => void;
	ariaLabel?: string;
	className?: string;
}

export function PanelCloseButton({
	onClose,
	ariaLabel = "Stäng",
	className = "",
}: PanelCloseButtonProps) {
	return (
		<button
			type="button"
			className={`panel-close-btn${className ? ` ${className}` : ""}`}
			onClick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			aria-label={ariaLabel}
		>
			<Icon path={close} fill="whitesmoke" iconSize="20" title="" />
		</button>
	);
}
