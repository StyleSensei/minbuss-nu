import type { Metadata } from "next";
import localFont from "next/font/local";
import Menu from "./components/menu/Menu";
import "./components/index.scss";
import Image from "next/image";
import { userAgent } from "next/server";
import { headers } from "next/headers";
import { Header } from "./components/Header";
import { DataProvider } from "./context/DataContext";
import { Analytics } from "@vercel/analytics/react";

const myFont = localFont({
	src: "/fonts/myfont.woff2",
	preload: true,
	variable: "--myfont",
});

const myFontBold = localFont({
	src: "/fonts/myfont-bold.woff2",
	preload: true,
	variable: "--myfont--bold",
});

export const fonts = { myFont, myFontBold };

export const metadata: Metadata = {
	title: "Min buss",
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
				<link rel="manifest" href="/site.webmanifest" />
			</head>
			<body className={`${fonts.myFont.variable} ${fonts.myFontBold.variable}`}>
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
