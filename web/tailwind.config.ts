import type { Config } from "tailwindcss";

/**
 * Tailwind v4 theme tokens live primarily in `src/app/globals.css` (`@theme inline`).
 * Scrollbar utilities: `@plugin "tailwind-scrollbar"` in globals.css (not this file).
 */
const config: Config = {
  darkMode: 'class',
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        foreground: "#0f172a",
        card: "#ffffff",
        muted: "#eef2f7",
        border: "#dbe3ee",
        surface: "#ffffff",
        primary: {
          DEFAULT: "#0055ff",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#2f6fff",
          600: "#0055ff",
          700: "#0047d4",
          800: "#0039aa",
          900: "#002d87",
        },
        "primary-hover": "#0047d4",
        "cyan-accent": "#00E5FF",
        "text-main": "#0f172a",
        "text-muted": "#475569",
        "border-color": "#dbe3ee",
        danger: "#EF4444",
        warning: "#F59E0B",
        success: "#10B981",
        "on-surface": "#191c1e",
        "on-surface-variant": "#424752",
        "on-primary": "#ffffff",
        "primary-container": "#005eb8",
        "on-primary-fixed-variant": "#00468c",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "inverse-surface": "#2d3133",
        outline: "#727783",
        "outline-variant": "#c2c6d4",
        "secondary-container": "#94efec",
        "on-secondary-container": "#006e6d",
        tertiary: "#703a00",
        "tertiary-fixed": "#ffdcc3",
        secondary: "#006a68",
      },
      fontFamily: {
        headline: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 40px rgba(0, 0, 0, 0.28)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(6%, -8%) scale(1.06)" },
          "66%": { transform: "translate(-5%, 5%) scale(0.97)" },
        },
      },
      animation: {
        blob: "blob 22s ease-in-out infinite",
        "blob-slow": "blob 32s ease-in-out infinite",
        "blob-delayed": "blob 26s ease-in-out 4s infinite",
      },
    },
  },
};

export default config;
