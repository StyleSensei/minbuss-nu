"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { MotionPathHelper } from "gsap/MotionPathHelper";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";
import { useIsMobile } from "../hooks/useIsMobile";
import colors from "../colors.module.scss";

gsap.registerPlugin(MotionPathPlugin);
gsap.registerPlugin(CustomEase);
gsap.registerPlugin(MotionPathHelper);

interface DemoMapProps {
	pathD: string;
	popupClass?: string;
	customPathForMobile?: string;
	className?: string;
}

export default function DemoMap({
	pathD,
	popupClass = "",
	customPathForMobile = "",
	className = "",
}: DemoMapProps) {
	const busRef = useRef<SVGCircleElement | null>(null);
	const popupRef = useRef<SVGGElement | null>(null);
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [isClient, setIsClient] = useState(false);
	const isMobileValue = useIsMobile();
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		setIsClient(true);
		setIsMobile(isMobileValue);
	}, [isMobileValue]);

	const pathToRender =
		isMobileValue && customPathForMobile ? customPathForMobile : pathD;

	useGSAP(() => {
		if (!busRef.current || !popupRef.current) return;

		const setPopupText = (textHead: string, textBody: string) => {
			if (!popupRef.current) return;
			const textElemHead = popupRef.current.querySelector("#popupTextHead");
			if (textElemHead) textElemHead.textContent = textHead;
			const textElemBody = popupRef.current.querySelector("#popupTextBody");
			if (textElemBody) textElemBody.textContent = textBody;
		};

		const tl = gsap.timeline({ repeat: -1 });

		gsap.set(busRef.current, { cx: -100, cy: 100 });

		const popupBox = popupRef.current.getBBox();
		gsap.set(popupRef.current, {
			x: -100 - popupBox.width / 2,
			y: 100 - popupBox.height - 20,
		});

		CustomEase.create(
			"busEase",
			"M0,0 C0,0 0.028,0.057 0.155,0.183 0.213,0.241 0.316,0.164 0.385,0.23 0.44,0.283 0.544,0.578 0.622,0.688 0.651,0.73 0.777,0.678 0.81,0.717 0.865,0.783 0.89,0.87 0.925,0.938 1.006,1.096 1,1.051 1,1.051 ",
		);

		const onUpdateFunction = () => {
			const bus = busRef.current;
			const popup = popupRef.current;
			if (!bus || !popup) return;
			if (svgRef.current === null) return;

			const busRect = bus.getBoundingClientRect();

			const point = svgRef.current.createSVGPoint();
			point.x = busRect.left + busRect.width / 2;
			point.y = busRect.top;

			const svgPoint = point.matrixTransform(
				svgRef.current.getScreenCTM()?.inverse(),
			);

			const popupBox = popup.getBBox();
			gsap.set(popup, {
				x: isClient && isMobile ? svgPoint.x + 40 : svgPoint.x + 20,
				y: isClient && isMobile ? svgPoint.y : svgPoint.y - popupBox.height,
			});
		};

		tl.to(busRef.current, {
			duration: 30,
			motionPath: {
				path: "#fullPath",
				align: "#fullPath",
				autoRotate: false,
				alignOrigin: [0.5, 0.5],
			},
			ease: "busEase",
			onUpdate: onUpdateFunction,
		});
		tl.add(() => busRef.current?.setAttribute("visibility", "visible"), 0);
		tl.add(() => popupRef.current?.setAttribute("visibility", "visible"), 1);
		tl.add(() => setPopupText("Linje 312", "Ankommer Hanholmen"), 0);
		tl.add(() => setPopupText("Linje 312", "Nästa, Portugal"), 10);
		tl.add(() => setPopupText("Linje 312", "Ankommer Portugal"), 17);
		tl.add(() => setPopupText("Linje 312", "Nästa, Hallstavägen"), 24);
	}, [isClient, isMobile]);

	if (!isClient && customPathForMobile) return null;

	return (
		<div className={`demo-map ${className}`}>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
			<svg
				viewBox="0 0 800 800"
				preserveAspectRatio="xMidYMid meet"
				ref={svgRef}
			>
				<path
					id="fullPath"
					fill="none"
					stroke="#00ffb3"
					strokeWidth={isMobile ? "4" : "2"}
					d={pathToRender}
				/>

				<g
					ref={popupRef}
					className={`demo-popup ${popupClass}`}
					visibility={"hidden"}
				>
					<rect
						x="0"
						y="0"
						width="115"
						height="40"
						rx="6"
						ry="6"
						fill={colors.primary}
						stroke="#00ffb3"
						strokeWidth="2"
					/>
					<text
						x="10"
						y="15"
						fontSize="9"
						fill="white"
						id="popupTextHead"
						fontWeight="bold"
						className="demo-popup-text"
					/>
					<text
						x="10"
						y="30"
						fontSize="9"
						fill="white"
						id="popupTextBody"
						className="demo-popup-text"
					/>
				</g>

				<circle
					ref={busRef}
					r={isMobile ? "20" : "10"}
					fill="#00ffb3"
					visibility={"hidden"}
				/>
			</svg>
		</div>
	);
}
