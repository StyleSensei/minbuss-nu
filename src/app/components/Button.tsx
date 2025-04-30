import { is } from "drizzle-orm";
import { useResetClicked } from "../hooks/useResetClicked";

interface ButtonProps {
	title?: string;
	text?: string;
	className?: string;
	id?: string;
	path?: string;
	pathFillRule1?: string;
	pathFillRule2?: string;
	onClick?: () => void;
	iconSize?: string;
	fill: string;
}

export const Button = ({
	title,
	text,
	className,
	id,
	path,
	pathFillRule1,
	pathFillRule2,
	onClick,
	iconSize = "18",
	fill,
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
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: < the button is described with button text > */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={iconSize}
				height={iconSize}
				fill={fill}
				viewBox="0 0 16 16"
				area-hidden="true"
				focusable="false"
			>
				{!text && <title>{title}</title>}
				<path fillRule="evenodd" d={pathFillRule1} />
				<path d={path} />
				<path fillRule="evenodd" d={pathFillRule2} />
			</svg>
			{text}
		</button>
	);
};
