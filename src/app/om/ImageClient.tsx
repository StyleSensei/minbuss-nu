"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface ImageClientProps {
	src?: string;
	alt?: string;
	priority?: boolean;
}

export default function ImageClient({ src, alt, priority }: ImageClientProps) {
	const imageContainerRef = useRef<HTMLDivElement>(null);
	const [isClient, setIsClient] = useState(false);
	const [isVisible, setIsVisible] = useState(false);

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
				threshold: 0.15,
			},
		);

		observer.observe(imageContainerRef.current);

		return () => observer.disconnect();
	}, [isClient]);
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
			className={`info__image client-image ${isVisible ? "visible" : ""}`}
			ref={imageContainerRef}
		>
			{src && alt && (
				<Image
					src={src}
					alt={alt}
					fill
					sizes="(max-width: 768px) 100vw, 50vw"
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
