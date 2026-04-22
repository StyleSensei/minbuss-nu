import type { ReactNode } from "react";

interface IconProps {
	path?: string;
	fill: string;
	iconSize: string;
	title: string;
	className?: string;
	label?: string;
	viewBox?: string;
	svgSrc?: string;
	svgNode?: ReactNode;
}

export const Icon = ({
	path,
	fill,
	iconSize,
	title,
	className,
	label,
	viewBox = "0 0 16 16",
	svgSrc,
	svgNode,
}: IconProps) => {
	const pixelSize = Number(iconSize);
	const sizeStyle = Number.isFinite(pixelSize)
		? { width: `${pixelSize}px`, height: `${pixelSize}px` }
		: { width: iconSize, height: iconSize };

	const graphic = svgNode ? (
		<span className={className} style={sizeStyle} aria-hidden>
			{svgNode}
		</span>
	) : svgSrc ? (
		<img
			src={svgSrc}
			alt=""
			aria-hidden
			className={className}
			style={sizeStyle}
			loading="lazy"
		/>
	) : (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={iconSize}
			height={iconSize}
			fill={fill}
			viewBox={viewBox}
			className={className}
		>
			<title>{title}</title>
			<path d={path ?? ""} />
		</svg>
	);

	return (
		<>
			{graphic}
			{label ? <span>{label}</span> : null}
		</>
	);
};
