import { Icon } from "./Icon";
import { info2 } from "../../../public/icons";
import { KeyboardEventHandler, useState } from "react";

export const Notification = () => {
	const [active, setActive] = useState<boolean>(true);
	const handleOnClick = () => {
		setActive(active ? !active : true);
	};
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "i") setActive(!active);
	};
	return (
		<div
			className={active ? "notification --active" : "notification"}
			onClick={handleOnClick}
			onKeyDown={handleKeyDown}
		>
			<Icon path={info2.path} fill="whitesmoke" title="info" iconSize="24" />
			<p>
				Vi har just nu problem med att visa realtidspositioner för ett antal
				busslinjer. Vi jobbar på att lösa problemet.
			</p>
		</div>
	);
};
