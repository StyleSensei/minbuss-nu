import axios from "axios";

export const get = async <T>(
	url: string,
	responseType: "json" | "arraybuffer" | "stream" = "json",
) => {
	const response = await axios.get<T>(url, {
		responseType: responseType,
	});
	return response.data;
};
