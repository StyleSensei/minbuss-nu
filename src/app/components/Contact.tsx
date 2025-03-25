import Link from "next/link";

export const Contact = () => {
	return (
		<div className="contact-links">
			<p>
				<Link href={"https://www.linkedin.com/in/patrikarell/"} target="_blank">
					Linkedin
				</Link>
			</p>
			<p>
				<Link href={"https://github.com/StyleSensei"} target="_blank">
					Github
				</Link>
			</p>
			<p>
				<Link href={"https://www.patrikarell.se"} target="_blank">
					Portfolio
				</Link>
			</p>
		</div>
	);
};
