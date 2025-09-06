import type { Metadata } from "next";
import localFont from "next/font/local";
import Menu from "./components/menu/Menu";
import "./components/index.scss";
import "./globals.css";
import Image from "next/image";
import { userAgent } from "next/server";
import { headers } from "next/headers";
import { Header } from "./components/Header";
import { DataProvider } from "./context/DataContext";
import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";
import colors from "./colors.module.scss";

const myFont = localFont({
	src: [
		{
			path: "/fonts/myfont.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "/fonts/myfont.woff",
			weight: "400",
			style: "normal",
		},
	],
	preload: true,
	variable: "--myfont",
	display: "swap",
	fallback: ["Arial", "sans-serif"],
});

const myFontBold = localFont({
	src: [
		{
			path: "/fonts/myfont-bold.woff2",
			weight: "700",
			style: "normal",
		},
		{
			path: "/fonts/myfont-bold.woff",
			weight: "700",
			style: "normal",
		},
	],
	preload: true,
	variable: "--myfont--bold",
	display: "swap",
	fallback: ["Arial", "sans-serif"],
});

export const fonts = { myFont, myFontBold };

export const metadata: Metadata = {
	title: { default: "Min buss.nu", template: "%s | Min buss.nu" },
	description: "Sök efter bussar i realtid",
	icons: "/favicon-96x96.png",
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
		<html lang="sv">
			<head>
				<link
					rel="icon"
					type="image/png"
					href="/favicon-96x96.png"
					sizes="96x96"
				/>
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<link rel="shortcut icon" href="/favicon.ico" />
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<meta name="apple-mobile-web-app-title" content="Min buss" />
				<meta name="theme-color" content={colors.primary} />
				<link rel="manifest" href="/site.webmanifest" />
			</head>
			<body
				className={`${fonts.myFont.variable} ${fonts.myFontBold.variable} ${GeistSans.variable}`}
			>
				<DataProvider>
					<Header />
					<main id="main" aria-label="Huvudinnehåll">
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
						<Analytics />
					</main>
				</DataProvider>
				<Menu />
			</body>
		</html>
	);
}
