import Link from "next/link";
import { usePathname } from "next/navigation";

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
	const pathname = usePathname();

	return (
		<Link
			href={href}
			tabIndex={0}
			className={`menu-item ${className} ${pathname === href ? "active" : ""}`}
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: < button is described by button text > */}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={iconSize}
				height={iconSize}
				fill={fill}
				viewBox="0 0 16 16"
				area-hidden="true"
				focusable="false"
			>
				<path d={path} />
			</svg>
			{title}
		</Link>
	);
};
