import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        canvas: "#f2f5fa",
        paper: "#ffffff",
        sunk: "#e9eef7",
        ink: { DEFAULT: "#131c2b", 2: "#4a5b73", 3: "#78889f" },
        line: { DEFAULT: "#dce3ee", 2: "#c8d3e3" },
        brand: { DEFAULT: "#1d4fd8", dark: "#1740ad", soft: "#e8eefc", line: "#b9cbf7" },
        ok: { DEFAULT: "#0b6b47", bg: "#e0f4ea", line: "#9ed9bf" },
        busy: { DEFAULT: "#b02532", bg: "#fdeaec", line: "#f3b8bf" },
        warn: { DEFAULT: "#8a5a00", bg: "#fcf1d7", line: "#ecc97a" },
        off: { DEFAULT: "#5a6b82", bg: "#e8ecf3", line: "#cdd6e3" },
        eq: {
          projector: "#1d4fd8", projectorBg: "#e8eefc",
          microphone: "#6d28d9", microphoneBg: "#f0e9fd",
          speaker: "#0b7a4b", speakerBg: "#e0f4ea",
          laptop: "#b45309", laptopBg: "#fdefdc",
          other: "#52627a", otherBg: "#e9edf3",
        },
      },
      fontFamily: {
        sans: ["Public Sans", "system-ui", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
      },
      borderRadius: { sm: "8px", DEFAULT: "12px", lg: "18px" },
      boxShadow: {
        card: "0 1px 2px rgba(19,28,43,.06), 0 6px 20px -12px rgba(19,28,43,.25)",
        lg: "0 12px 40px -12px rgba(19,28,43,.3)",
      },
    },
  },
  plugins: [],
};
export default config;
