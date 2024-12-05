interface IconProps {
	path: string;
	fill: string;
	iconSize: string;
	title: string;
}

export const Icon = ({ path, fill, iconSize, title }: IconProps) => {
	return (
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
	);
};
