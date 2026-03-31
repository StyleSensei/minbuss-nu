interface IconProps {
	path: string;
	fill: string;
	iconSize: string;
	title: string;
	className?: string;
	label?: string;
	viewBox?: string;
}

export const Icon = ({
	path,
	fill,
	iconSize,
	title,
	className,
	label,
	viewBox = "0 0 16 16",
}: IconProps) => {
	return (
		<>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={iconSize}
				height={iconSize}
				fill={fill}
				viewBox={viewBox}
				className={className}
			>
				<title>{title}</title>
				<path d={path} />
			</svg>
			<span id="label">{label}</span>
		</>
	);
};
