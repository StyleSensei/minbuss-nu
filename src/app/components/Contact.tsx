import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Contact = () => {
	return (
		<ul className="contact-links">
			<Avatar className="contact-avatar">
				<AvatarImage src="/patrik.webp" alt="Patrik Arell" />
				<AvatarFallback>PA</AvatarFallback>
			</Avatar>
			<li>
				<a
					href={"https://www.linkedin.com/in/patrikarell/"}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Öppnar Patrik Arells Linkedin-profil i en ny flik"
				>
					Linkedin
				</a>
			</li>
			<li>
				<a
					href={"https://github.com/StyleSensei"}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Öppnar Patrik Arells Github-profil i en ny flik"
				>
					Github
				</a>
			</li>
			<li>
				<a
					href={"https://www.patrikarell.se"}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Öppnar Patrik Arells portfolio i en ny flik"
				>
					Portfolio
				</a>
			</li>
		</ul>
	);
};
