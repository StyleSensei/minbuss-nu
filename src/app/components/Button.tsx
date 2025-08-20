import { useResetClicked } from "../hooks/useResetClicked";
import type React from "react";
import type { ReactNode } from "react";

interface ButtonProps {
	id?: string;
	title?: string;
	text?: string;
	className?: string;
	onClick?: () => void;
	path?: string;
	path2?: string;
	pathFillRule1?: string;
	pathFillRule2?: string;
	viewBox?: string;
	iconSize?: string | number;
	fill?: string;
	color?: string;
}

export const Button = ({
	id,
	title,
	text,
	className,
	onClick,
	path,
	path2,
	pathFillRule1,
	pathFillRule2,
	viewBox = "0 0 16 16",
	iconSize = 18,
	fill = "none",
	color,
}: ButtonProps) => {
	const { isClicked, setIsClicked } = useResetClicked();
	const handleOnClick = () => {
		if (onClick) {
			onClick();
		}
		setIsClicked(true);
	};

	return (
		<button
			className={`${className ? `button ${className}` : "button"} ${isClicked ? "clicked" : ""}`}
			type="button"
			id={id}
			onClick={handleOnClick}
			tabIndex={0}
			// area-label={title}
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: <the button is described with button text> */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={iconSize}
				height={iconSize}
				fill={fill}
				viewBox={viewBox}
				area-hidden="true"
				focusable="false"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				stroke={color}
			>
				{!text && <title>{title}</title>}
				<path fillRule="evenodd" d={pathFillRule1} />
				<path d={path} />
				{path2 && <path d={path2} />}
				<path fillRule="evenodd" d={pathFillRule2} />
			</svg>

			{text}
		</button>
	);
};
