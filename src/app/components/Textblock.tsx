interface TextBlockProps {
	title?: string;
	h2?: string;
	description?: string;
	className?: string;
}
export default function TextBlock({
	title,
	h2,
	description,
	className,
}: TextBlockProps) {
	const sentences = description
		?.split("/")
		.filter((sentence) => sentence.trim());
	return (
		<section className={`text-block ${className || ""}`}>
			{title && <h1>{title}</h1>}
			{h2 && <h2>{h2}</h2>}
			{sentences?.map((sentence, i) => {
				if (sentence) {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<p key={i}>{sentence}</p>
					);
				}
			})}
		</section>
	);
}
