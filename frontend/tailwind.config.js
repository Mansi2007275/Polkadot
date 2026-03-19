/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        "bg-card": "#0a0a0a",
        border: "#222",
        "border-focus": "#333",
        neon: {
          pink: "#E6007A",
          blue: "#0070F3",
          purple: "#7928ca",
          green: "#00ff88",
        },
        primary: {
          pink: "#E6007A",
          purple: "#7928ca",
          blue: "#0070F3",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sora: ["Sora", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
      },
      boxShadow: {
        "glow-pink": "0 0 12px rgba(230, 0, 122, 0.3)",
        "glow-blue": "0 0 12px rgba(0, 112, 243, 0.3)",
        "glow-green": "0 0 12px rgba(0, 255, 136, 0.3)",
      },
    },
  },
  plugins: [],
};
