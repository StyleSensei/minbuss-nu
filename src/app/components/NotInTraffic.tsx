interface INotInTrafficProps {
	userInput: string;
}
const NotInTraffic = ({ userInput }: INotInTrafficProps) => {
	return (
		<p className="error-message">
			Inga bussar från linje {userInput} i trafik just nu. 😴
		</p>
	);
};
export default NotInTraffic;
