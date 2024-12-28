import type { Metadata } from "next";
import localFont from "next/font/local";
import "../styles/globals.css";
import Menu from "./components/menu/Menu";
import "./components/index.scss";
import Image from "next/image";
import { userAgent } from "next/server";
import { headers } from "next/headers";
import { Button } from "./components/Button";
import { bus, search } from "../../public/icons";
import { SearchBar } from "./components/SearchBar";
import { Header } from "./components/Header";
import { DataProvider } from "./context/DataContext";
import Link from "next/link";
import { LinkButton } from "./components/LinkButton";

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
	weight: "100 900",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
	weight: "100 900",
});

export const metadata: Metadata = {
	title: "Var är bussen?",
	description: "Sök efter bussar i realtid",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const requestHeaders = await headers();
	const { device } = userAgent({ headers: requestHeaders });
	const deviceType = device?.type === "mobile" ? "mobile" : "desktop";

	const imageSrc =
		deviceType === "mobile"
			? "/wait-for-bus_mobile.jpg"
			: "/wait-for-bus_desktop.jpg";

	return (
		<html lang="en">
			<body>
				<DataProvider>
					<Header />
					<main id="main">
						<Image
							src={imageSrc}
							fill
							alt="Kvinna som väntar på bussen i regnet"
							quality={60}
							style={{ objectFit: "cover", zIndex: -1 }}
							className="background-image"
							id="background-image"
						/>
						{children}
					</main>
				</DataProvider>
				<Menu />
			</body>
		</html>
	);
}
