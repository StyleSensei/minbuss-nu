import Image from "next/image";

interface ImageServerProps {
	src?: string;
	alt?: string;
	priority?: boolean;
}

export default function ImageServer({ src, alt, priority }: ImageServerProps) {
	const safeSelector = src?.replace(/[^\w-]/g, "-");

	return (
		<div
			className={`info__image server-image max-w-full md:max-w-[60%] xl:max-w-[40%] server-image-${safeSelector}`}
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
