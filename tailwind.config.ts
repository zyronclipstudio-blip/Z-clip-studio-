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
        background: "#05060a",
        obsidian: "#05060a",
        surface: "#11141b",
        "surface-raised": "#181c25",
        "surface-card": "#0e1118",
        border: "#242a35",
        "border-glow": "#d9b45b",
        ink: "#eceff4",
        muted: "#8d97a8",
        gold: {
          DEFAULT: "#d9b45b",
          light: "#ecd083",
          champagne: "#ecd083",
          muted: "#b88f38",
        },
        success: "#30C98B",
        warning: "#F2B84B",
        danger: "#F26D75",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(217, 180, 91, 0.24)",
        "glow-card": "0 8px 32px 0 rgba(184, 143, 56, 0.18)",
        "glow-btn": "0 0 20px rgba(217, 180, 91, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
