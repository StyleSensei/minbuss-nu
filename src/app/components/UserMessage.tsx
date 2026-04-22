import { info2 } from "../../../public/icons";
import { Icon } from "./Icon";

type UserMessageProps = {
	title?: string;
	message?: string;
};

const UserMessage = ({
	title = "Platstjänster avslaget.",
	message = "Aktivera platstjänster för full funktionallitet.",
}: UserMessageProps) => {
	return (
		<>
			<p className="warn-message">
				<Icon
					path={info2.path}
					iconSize="20px"
					fill="black"
					title="info"
					className="no-position-icon"
				/>
				<strong>{title}</strong> {message}
			</p>
		</>
	);
};
export default UserMessage;
