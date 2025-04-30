import { useEffect, useState } from "react";

export const useResetClicked = () => {
	const [isClicked, setIsClicked] = useState(false);

	useEffect(() => {
		if (isClicked) {
			const timer = setTimeout(() => {
				setIsClicked(false);
			}, 300);

			return () => clearTimeout(timer);
		}
	}, [isClicked]);

	return { isClicked, setIsClicked };
};
