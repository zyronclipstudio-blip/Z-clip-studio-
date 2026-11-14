import type { Config } from "tailwindcss";

// ZClip design tokens (Master Builder Specification v1.2, section 08).
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B11", // Obsidian background
        surface: "#101722", // Graphite surface
        "surface-raised": "#172230", // Elevated surface
        border: "#263345",
        ink: "#F4F7FB", // Primary text
        muted: "#9AA8BA", // Secondary text
        cyan: { DEFAULT: "#39D7F2" }, // Primary actions, focus, active
        violet: { DEFAULT: "#8C7BFF" }, // Secondary accent only
        success: "#30C98B",
        warning: "#F2B84B",
        danger: "#F26D75",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-space)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
