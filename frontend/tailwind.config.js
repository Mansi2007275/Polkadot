/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        polkadot: {
          pink:  "#E6007A",
          dark:  "#0D0D0D",
          gray:  "#1A1A1A",
        },
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
