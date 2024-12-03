import Link from "next/link";

interface MenuItemProps {
	title: string;
	href: string;
	iconSize: string;
	className: string;
	path: string;
	fill: string;
}

export const MenuItem = ({
	title,
	href,
	iconSize,
	className,
	path,
	fill,
}: MenuItemProps) => {
	return (
		<Link href={href} tabIndex={0} className={`menu-item ${className}`}>
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
		</Link>
	);
};
