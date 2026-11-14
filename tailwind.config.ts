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
        background: "#080B11",
        obsidian: "#0A0A0E",
        surface: "#101726",
        "surface-raised": "#151F33",
        "surface-card": "#0D1424",
        border: "#1C283F",
        "border-glow": "#0075FF",
        ink: "#F4F7FB",
        muted: "#8A99AD",
        // The Master Blueprint Palette:
        electric: "#00D4FF", // Electric Blue #001AFF / #00D4FF
        deepblue: "#0075FF", // Deep Blue #0075FF
        royalblue: "#001AFF", // Royal Blue #001AFF
        charcoal: "#1A1A1A",
        silver: "#B0B6C9",
        cyan: {
          DEFAULT: "#00D4FF",
          glow: "rgba(0, 212, 255, 0.4)",
        },
        success: "#30C98B",
        warning: "#F2B84B",
        danger: "#F26D75",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-space)", "Orbitron", "-apple-system", "sans-serif"],
        orbitron: ["Orbitron", "sans-serif"],
        mono: ["var(--font-plex)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(0, 212, 255, 0.35)",
        "glow-card": "0 8px 32px 0 rgba(0, 26, 255, 0.25)",
        "glow-btn": "0 0 20px rgba(0, 117, 255, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
