import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = "src";
const NEXT_IMPORTS = [
	"next/navigation",
	"next/server",
	"next/headers",
	"next/image",
	"next/link",
	"next/form",
	"next/font/local",
];

async function* walk(dir) {
	const files = await readdir(dir, { withFileTypes: true });
	for (const file of files) {
		const res = path.resolve(dir, file.name);
		if (file.isDirectory()) {
			yield* walk(res);
		} else if (file.isFile() && (res.endsWith(".ts") || res.endsWith(".tsx"))) {
			yield res;
		}
	}
}

async function fixImports() {
	try {
		for await (const filePath of walk(SRC_DIR)) {
			let content = await readFile(filePath, "utf8");
			let modified = false;

			// Fix relative imports
			const importRegex = /from ['"]([^'"]+)['"]/g;
			content = content.replace(importRegex, (match, importPath) => {
				if (importPath.startsWith(".") && !importPath.endsWith(".js")) {
					modified = true;
					// Keep the JSX extension for components
					if (
						importPath.endsWith(".tsx") ||
						importPath.includes("/components/") ||
						importPath.includes("/context/")
					) {
						return `from '${importPath.replace(/\.tsx?$/, "")}.jsx'`;
					}
					return `from '${importPath.replace(/\.tsx?$/, "")}.js'`;
				}
				// Don't modify Next.js imports or node_modules imports
				if (
					NEXT_IMPORTS.some((ni) => importPath.startsWith(ni)) ||
					!importPath.startsWith("@/")
				) {
					return match;
				}
				// Fix absolute imports
				if (importPath.startsWith("@/")) {
					modified = true;
					if (
						importPath.includes("/components/") ||
						importPath.includes("/context/")
					) {
						return `from '${importPath.replace(/\.tsx?$/, "")}.jsx'`;
					}
					return `from '${importPath.replace(/\.tsx?$/, "")}.js'`;
				}
				return match;
			});

			if (modified) {
				await writeFile(filePath, content, "utf8");
				console.log(`Fixed imports in ${filePath}`);
			}
		}
		console.log("All imports have been fixed!");
	} catch (error) {
		console.error("Error fixing imports:", error);
	}
}

fixImports();
