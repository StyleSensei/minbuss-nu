interface ISearchErrorProps {
	proposedRoute?: string | undefined;
	userInput?: string | undefined;
	errorText?: string | undefined | null;
}

const SearchError = ({
	proposedRoute,
	userInput,
	errorText,
}: ISearchErrorProps) => {
	if (proposedRoute) {
		return (
			<p className="error-message">
				Linjen finns inte. 🤷‍♂️ Menade du {proposedRoute}?
			</p>
		);
	}
	if (userInput) {
		return (
			<p className="error-message">
				Inga bussar från linje {userInput} i trafik just nu. 😴
			</p>
		);
	}

	if (errorText) {
		return (
			<p className="error-message">
				{errorText} 🤷‍♂️{" "}
				<a
					href="https://status.trafiklab.se/sv"
					target="_blank"
					rel="noopener noreferrer"
				>
					https://status.trafiklab.se/sv
				</a>{" "}
			</p>
		);
	}
	return;
};
export default SearchError;
