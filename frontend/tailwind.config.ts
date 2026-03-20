import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dot:    { pink: "#FE7EC4", light: "#FF9AD3" },
        bg:     { base: "#010814", surface: "#050D1A", card: "#091525" },
        border: { DEFAULT: "#152338", subtle: "#0A1929" },
        brand:  { blue: "#80B8F9", pink: "#FE7EC4", yellow: "#FFFFC2" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
