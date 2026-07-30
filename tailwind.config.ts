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
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-border": "var(--surface-border)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "accent-indigo": "var(--accent-indigo)",
        "accent-indigo-hover": "var(--accent-indigo-hover)",
        "accent-amber": "var(--accent-amber)",
        "accent-amber-soft": "var(--accent-amber-soft)",
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      }
    },
  },
  plugins: [],
};
export default config;
