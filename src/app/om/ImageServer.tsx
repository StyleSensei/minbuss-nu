import Image from "next/image";
import { ClientWrapper } from "../components/ClientWrapper";

interface ImageServerProps {
	src?: string;
	alt?: string;
	priority?: boolean;
}

export default function ImageServer({ src, alt, priority }: ImageServerProps) {
	const safeSelector = src?.replace(/[^\w-]/g, "-");

	return (
		<ClientWrapper>
			<div
				className={`info__image server-image relative md:max-w-[60%] xl:max-w-[40%] server-image-${safeSelector}`}
			>
				{src && alt && (
					<Image
						src={src}
						alt={alt}
						fill
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 40vw"
						priority={priority}
					/>
				)}
			</div>
		</ClientWrapper>
	);
}
