"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useIsMobile } from "../hooks/useIsMobile";
import { is } from "drizzle-orm";

interface ImageClientProps {
	src?: string;
	alt?: string;
	priority?: boolean;
}

export default function ImageClient({ src, alt, priority }: ImageClientProps) {
	const imageContainerRef = useRef<HTMLDivElement>(null);
	const [isClient, setIsClient] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const isMobile = useIsMobile();

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient || !imageContainerRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				setIsVisible(entry.isIntersecting);
			},
			{
				threshold: isMobile ? 0.15 : 0.7,
				rootMargin: "300px 0px -200px 0px",
			},
		);

		observer.observe(imageContainerRef.current);

		return () => observer.disconnect();
	}, [isClient, isMobile]);
	useEffect(() => {
		if (!isClient || !src) return;

		const safeSelector = src.replace(/[^\w-]/g, "-");
		const serverImage = document.querySelector(`.server-image-${safeSelector}`);

		if (serverImage) {
			serverImage.classList.add("hidden");
		}
	}, [isClient, src]);

	if (!isClient) return null;

	return (
		<div
			className={`info__image client-image max-w-full md:max-w-[60%]  xl:max-w-[40%] ${isVisible ? "visible" : ""}`}
			ref={imageContainerRef}
		>
			{src && alt && (
				<Image
					src={src}
					alt={alt}
					fill
					sizes="(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 40vw"
					style={{
						objectFit: "contain",
						objectPosition: "left",
					}}
					priority={priority}
				/>
			)}
		</div>
	);
}
