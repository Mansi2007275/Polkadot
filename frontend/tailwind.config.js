/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0b0f",
        card: "#12121a",
        primary: {
          pink: "#ff007a",
          purple: "#7928ca",
          blue: "#0070f3",
        },
        polkadot: {
          pink:  "#E6007A",
          dark:  "#0D0D0D",
          gray:  "#1A1A1A",
        },
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        sora: ["Sora", "sans-serif"],
        space: ["'Space Grotesk'", "sans-serif"],
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(230, 0, 122, 0.3)',
        'glow-purple': '0 0 20px rgba(121, 40, 202, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 112, 243, 0.3)',
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
