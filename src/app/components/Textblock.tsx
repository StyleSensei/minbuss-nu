interface TextBlockProps {
	title?: string;
	description?: string;
	className?: string;
}
export default function TextBlock({
	title,
	description,
	className,
}: TextBlockProps) {
	return (
		<div className={`text-block ${className}`}>
			<h1>{title}</h1>
			{description?.split("/").map((sentence, i) => {
				if (sentence) {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
						<p key={i} className="sentence">
							{sentence}
						</p>
					);
				}
			})}
		</div>
	);
}
