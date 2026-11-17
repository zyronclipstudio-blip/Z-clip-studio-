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
        background: "#08080A",
        obsidian: "#08080A",
        surface: "#111114",
        "surface-raised": "#1B1914",
        "surface-card": "#100F0D",
        border: "#302817",
        "border-glow": "#D4AF37",
        ink: "#F5F1E6",
        muted: "#A39A86",
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E5C76B",
          champagne: "#F3E3B3",
          muted: "#BFA15A",
        },
        success: "#30C98B",
        warning: "#F2B84B",
        danger: "#F26D75",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-space)", "-apple-system", "sans-serif"],
        mono: ["var(--font-plex)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(212, 175, 55, 0.24)",
        "glow-card": "0 8px 32px 0 rgba(139, 106, 34, 0.18)",
        "glow-btn": "0 0 20px rgba(212, 175, 55, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
