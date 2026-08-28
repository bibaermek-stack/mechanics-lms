import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd2ff",
          300: "#8fb4ff",
          400: "#5c8dff",
          500: "#3366ff",
          600: "#1f47e6",
          700: "#1a39b8",
          800: "#1a3391",
          900: "#1a2f73",
          950: "#0f1a45",
        },
        // Accent ramp used for the aurora gradients and glow edges.
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
        cyan: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
        },
        surface: {
          light: "#f5f7fa",
          // Deep space base the glass panels float on.
          dark: "#05070f",
          panel: "#0b1020",
        },
      },
      fontSize: {
        display: ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.035em", fontWeight: "700" }],
        h1: ["clamp(1.5rem, 1.1rem + 2.2vw, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
        h2: ["1.375rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "650" }],
        h3: ["1.0625rem", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.65" }],
        label: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.08em", fontWeight: "600" }],
        micro: ["0.75rem", { lineHeight: "1.5" }],
        data: ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "data-sm": ["1.25rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      borderRadius: {
        // The 20–30px range the brief calls for.
        xl2: "1.25rem",
        "2xl2": "1.5rem",
        "3xl2": "1.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(2, 6, 23, 0.06), 0 1px 3px rgba(2, 6, 23, 0.05)",
        raised: "0 8px 24px rgba(2, 6, 23, 0.14)",
        // Depth for floating glass panels.
        float: "0 24px 60px -20px rgba(2, 6, 23, 0.55), 0 8px 24px -12px rgba(2, 6, 23, 0.4)",
        "glow-brand": "0 0 0 1px rgba(92, 141, 255, 0.25), 0 12px 48px -12px rgba(51, 102, 255, 0.55)",
        "glow-violet": "0 0 0 1px rgba(167, 139, 250, 0.25), 0 12px 48px -12px rgba(139, 92, 246, 0.5)",
        "glow-cyan": "0 0 0 1px rgba(103, 232, 249, 0.25), 0 12px 48px -12px rgba(34, 211, 238, 0.45)",
      },
      backgroundImage: {
        "aurora-brand": "linear-gradient(135deg, #3366ff 0%, #8b5cf6 50%, #22d3ee 100%)",
        "aurora-soft": "linear-gradient(135deg, rgba(51,102,255,0.16), rgba(139,92,246,0.14), rgba(34,211,238,0.12))",
      },
      keyframes: {
        // Slow ambient drift for the aurora blobs — transform-only, so it stays
        // on the compositor thread.
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%, -6%, 0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%, 4%, 0) scale(0.95)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "grid-pan": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 -56px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { transform: "scale(1.25)", opacity: "0" },
        },
        "scroll-hint": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "50%": { transform: "translateY(7px)", opacity: "1" },
        },
      },
      animation: {
        drift: "drift 22s ease-in-out infinite",
        "drift-slow": "drift 34s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "grid-pan": "grid-pan 3.5s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite",
        "scroll-hint": "scroll-hint 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
