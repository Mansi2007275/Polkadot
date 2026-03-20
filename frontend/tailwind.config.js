/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        accent: "#6366f1",
        "accent-hover": "#4f46e5",
        "primary-pink": "#6366f1",
        "primary-purple": "#7c3aed",
        "primary-blue": "#2563eb",
        "neon-pink": "#6366f1",
        "neon-blue": "#2563eb",
        "neon-green": "#059669",
        "neon-purple": "#7c3aed",
      },
    },
  },
  plugins: [],
};
