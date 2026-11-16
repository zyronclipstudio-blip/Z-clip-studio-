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
        background: "#0B0810",
        obsidian: "#0B0810",
        surface: "#17121B",
        "surface-raised": "#211825",
        "surface-card": "#15101A",
        border: "#3A2738",
        "border-glow": "#EC8CBA",
        ink: "#FFF7FB",
        muted: "#B6A5B2",
        gold: {
          DEFAULT: "#EC8CBA",
          light: "#FFC3DE",
          champagne: "#FFEAF3",
          muted: "#C777A6",
        },
        // Backward-compatible aliases for existing workflow components.
        electric: "#EC8CBA",
        deepblue: "#874567",
        royalblue: "#EC8CBA",
        charcoal: "#211825",
        silver: "#E2CFDA",
        cyan: {
          DEFAULT: "#D4AF37",
          glow: "rgba(212, 175, 55, 0.32)",
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
        glow: "0 0 25px rgba(236, 140, 186, 0.22)",
        "glow-card": "0 12px 40px 0 rgba(135, 69, 103, 0.18)",
        "glow-btn": "0 0 20px rgba(236, 140, 186, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
