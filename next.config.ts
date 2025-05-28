import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			"@shared": "./src/shared",
		};
		return config;
	},
};

export default nextConfig;
