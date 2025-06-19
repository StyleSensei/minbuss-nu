interface TextBlockProps {
	title?: string;
	h2?: string;
	h3?: string;
	descriptionId?: string;
	description?: string;
	className?: string;
	h1ClassName?: string;
	h2ClassName?: string;
	h3ClassName?: string;
	descriptionClassName?: string;
}
export default function TextBlock({
	title,
	h2,
	h3,
	descriptionId,
	description,
	className,
	h1ClassName = "text-block__title",
	h2ClassName = "text-block__subtitle",
	h3ClassName = "text-block__subtitle",
	descriptionClassName = "text-block__description",
}: TextBlockProps) {
	const sentences = description
		?.split("/")
		.filter((sentence) => sentence.trim());
	return (
		<div className={`text-block ${className || ""}`}>
			{title && <h1 className={h1ClassName}>{title}</h1>}
			{h2 && <h2 className={h2ClassName}>{h2}</h2>}
			{h3 && <h3 className={h3ClassName}>{h3}</h3>}
			{sentences?.map((sentence, i) => {
				if (sentence) {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<p key={i} className={descriptionClassName} id={descriptionId}>
							{sentence}
						</p>
					);
				}
			})}
		</div>
	);
}
