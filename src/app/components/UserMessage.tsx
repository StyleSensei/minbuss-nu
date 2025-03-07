import { info2 } from "../../../public/icons";
import { Icon } from "./Icon";

const UserMessage = () => {
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
				<strong>Platstjänster avslaget.</strong> Aktivera platstjänster för full
				funktionallitet.
			</p>
		</>
	);
};
export default UserMessage;
