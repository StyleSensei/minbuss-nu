interface TextBlockProps {
	title?: string;
	h2?: string;
	h3?: string;
	description?: string;
	className?: string;
}
export default function TextBlock({
	title,
	h2,
	h3,
	description,
	className,
}: TextBlockProps) {
	const sentences = description
		?.split("/")
		.filter((sentence) => sentence.trim());
	return (
		<div className={`text-block ${className || ""}`}>
			{title && <h1>{title}</h1>}
			{h2 && <h2>{h2}</h2>}
			{h3 && <h3>{h3}</h3>}
			{sentences?.map((sentence, i) => {
				if (sentence) {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<p key={i}>{sentence}</p>
					);
				}
			})}
		</div>
	);
}
