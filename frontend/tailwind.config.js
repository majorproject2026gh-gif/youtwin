/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          50: "#FBF7ED",
          100: "#F7F1E4",
          200: "#EFE7D8",
          300: "#D8CBAE",
          400: "#C7B896",
        },
        ink: {
          950: "#1A1610",
          900: "#241E17",
          700: "#4A4231",
          500: "#5C5443",
          300: "#8A8070",
        },
        rec: {
          400: "#D8433F",
          500: "#C22A2A",
          600: "#A31F1F",
        },
        cited: {
          400: "#D9A441",
          500: "#C0872B",
        },
        // Used for the headline accent gradient and glow blobs across
        // several pages — was referenced via raw hex in inline styles
        // but never added as an actual Tailwind color, so any
        // `coral-*` utility classes silently produced no styling.
        coral: {
          400: "#FF8266",
          500: "#F2603F",
        },
        // Used for "grounded / live / verified" status indicators
        // (pulsing dots, confidence badges) across the hero, login, and
        // create-video pages — same bug as `coral` above: referenced as
        // a utility class but never defined, so these dots were
        // rendering with no color at all.
        verified: {
          500: "#10B981",
        },
        twin: {
          indigo: "#4F46E5",
          green: "#10B981",
          orange: "#EA580C",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
