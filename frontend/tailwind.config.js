import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "ui-serif", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: {
          50: "#f4f6fb",
          100: "#e8ecf6",
          200: "#cdd6ec",
          300: "#a2b3db",
          400: "#7089c6",
          500: "#4d68b1",
          600: "#3a5196",
          700: "#30427a",
          800: "#2b3966",
          900: "#1b2340",
          950: "#11162b",
        },
      },
    },
  },
  plugins: [typography],
};
