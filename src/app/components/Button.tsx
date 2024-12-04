interface ButtonProps {
	title: string;
	className?: string;
	id?: string;
	path?: string;
	onClick?: () => void;
	iconSize?: string;
	fill: string;
}

export const Button = ({
	title,
	className,
	id,
	path,
	onClick,
	iconSize = "18",
	fill,
}: ButtonProps) => {
	return (
		<button
			className={className ? `button ${className}` : "button"}
			type="button"
			id={id}
			onClick={onClick}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={iconSize}
				height={iconSize}
				fill={fill}
				viewBox="0 0 16 16"
			>
				<title>{title}</title>
				<path d={path} />
			</svg>
			{title}
		</button>
	);
};
