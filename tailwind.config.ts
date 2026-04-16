import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0d0d", // Deep dark background
        surface: "#1a1a1a",    // Card background
        primary: "#22c55e",    // Green for odds
        secondary: "#ef4444",  // Red for odds
        text: "#e5e5e5",       // Primary text
        subtext: "#a3a3a3",    // Muted text
        accent: "#3b82f6",     // Blue accent
      },
    },
  },
  plugins: [],
};
export default config;