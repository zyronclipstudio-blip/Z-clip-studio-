import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
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
        cyan: {
          DEFAULT: "#39D7F2",
          50: "#f0fbff",
          100: "#e0f7fe",
          200: "#b9f0fd",
          300: "#7ce4fa",
          400: "#39d7f2",
          500: "#0ec1e1",
          600: "#069bc1",
          700: "#097c9c",
          800: "#0f647d",
          900: "#125368",
        },
        violet: {
          DEFAULT: "#8C7BFF",
        },
        success: "#30C98B",
        warning: "#F2B84B",
        danger: "#F26D75",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-space)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
