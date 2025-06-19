/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: [
		"./app/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
			},
			fontFamily: {
				sans: ["var(--font-sans)"],
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
