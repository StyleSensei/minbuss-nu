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
			<p>{description}</p>
		</div>
	);
}
