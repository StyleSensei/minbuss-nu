import { defineConfig } from "vitest/config";
import tsconfigPaths from "tsconfig-paths";

export default defineConfig({
	test: {
		environment: "node",
	},
	resolve: {
		alias: {
			"@": "/src",
			"@shared": "/src/shared",
		},
	},
});
