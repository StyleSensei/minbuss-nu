import Link from "next/link";

export const Contact = () => {
	return (
		<ul className="contact-links">
			<li>
				<Link
					href={"https://www.linkedin.com/in/patrikarell/"}
					target="_blank"
					aria-label="Öppnar Patrik Arells Linkedin-profil i en ny flik"
				>
					Linkedin
				</Link>
			</li>
			<li>
				<Link
					href={"https://github.com/StyleSensei"}
					target="_blank"
					aria-label="Öppnar Patrik Arells Github-profil i en ny flik"
				>
					Github
				</Link>
			</li>
			<li>
				<Link
					href={"https://www.patrikarell.se"}
					target="_blank"
					aria-label="Öppnar Patrik Arells portfolio i en ny flik"
				>
					Portfolio
				</Link>
			</li>
		</ul>
	);
};
