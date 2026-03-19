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
        dot:    { pink: "#E6007A", light: "#FF2D94" },
        bg:     { base: "#0D0D0D", surface: "#141414", card: "#1A1A1A" },
        border: { DEFAULT: "#2A2A2A", subtle: "#1E1E1E" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
