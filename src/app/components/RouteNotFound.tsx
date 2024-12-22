interface IRouteNotFoundProps {
	proposedRoute: string | undefined;
}

const RouteNotFound = ({ proposedRoute }: IRouteNotFoundProps) => {
	return (
		<p className="error-message">
			Linjen finns inte. 🤷‍♂️ Menade du {proposedRoute}?
		</p>
	);
};
export default RouteNotFound;
