import Link from "next/link";

export const Contact = () => {
	return (
		<ul className="contact-links">
			<li>
				<Link href={"https://www.linkedin.com/in/patrikarell/"} target="_blank">
					Linkedin
				</Link>
			</li>
			<li>
				<Link href={"https://github.com/StyleSensei"} target="_blank">
					Github
				</Link>
			</li>
			<li>
				<Link href={"https://www.patrikarell.se"} target="_blank">
					Portfolio
				</Link>
			</li>
		</ul>
	);
};
