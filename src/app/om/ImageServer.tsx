import Image from "next/image";

interface ImageServerProps {
	src?: string;
	alt?: string;
	priority?: boolean;
}

export default function ImageServer({ src, alt, priority }: ImageServerProps) {
	const safeSelector = src?.replace(/[^\w-]/g, "-");

	return (
		<div className={`info__image server-image server-image-${safeSelector}`}>
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
