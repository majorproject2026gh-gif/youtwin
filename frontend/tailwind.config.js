/** @type {import('tailwindcss').Config} */

// Semantic colors resolve to CSS variables (see styles/globals.css) so
// the same markup renders correctly in dark AND in the light theme on
// the pages that opt into it (.theme-aware) — no per-element
// `theme === "dark" ? … : …` branching needed.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Semantic (theme-aware) ----
        canvas: v("canvas"), // page background
        fg: v("fg"), // primary text; use /70 /50 /35 for hierarchy
        tint: v("tint"), // translucent surfaces + hairlines: bg-tint/[0.04], border-tint/10
        sunk: v("sunk"), // recessed wells (chips, inputs on cards): bg-sunk/30

        // ---- Brand: "night" is the cinematic base the dark UI is built on
        // Elevation scale — theme-aware (dark: near-black steps; light: paper → white)
        night: {
          950: v("night-950"),
          900: v("night-900"),
          850: v("night-850"),
          800: v("night-800"),
          700: v("night-700"),
          600: v("night-600"),
        },

        // ---- Existing palette (kept — the YouTwin identity) ----
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
          300: v("rec-300"),
          400: v("rec-400"),
          500: "#C8302B",
          600: "#A3201E",
          700: "#7E1716",
        },
        cited: {
          300: v("cited-300"),
          400: v("cited-400"),
          500: "#C8902F",
        },
        coral: {
          300: v("coral-300"),
          400: v("coral-400"),
          500: "#F2603F",
        },
        verified: {
          400: v("verified-400"),
          500: "#10B981",
        },
        signal: {
          400: v("signal-400"),
          500: "#2DD4BF",
        },
        twin: {
          indigo: "#4F46E5",
          green: "#10B981",
          orange: "#EA580C",
        },
      },
      fontFamily: {
        display: ["Geist", "Inter", "system-ui", "sans-serif"],
        body: ["Geist", "Inter", "system-ui", "sans-serif"],
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["'Geist Mono'", "'IBM Plex Mono'", "ui-monospace", "monospace"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      boxShadow: {
        // Layered "real" elevation: contact shadow + ambient shadow + top highlight
        card: "0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 0 0 1px rgb(255 255 255 / 0.06) inset, 0 1px 2px rgb(0 0 0 / 0.4), 0 12px 32px -8px rgb(0 0 0 / 0.55)",
        lift: "0 1px 0 0 rgb(255 255 255 / 0.08) inset, 0 0 0 1px rgb(255 255 255 / 0.08) inset, 0 2px 4px rgb(0 0 0 / 0.4), 0 30px 60px -12px rgb(0 0 0 / 0.7)",
        glow: "0 0 0 1px rgb(200 48 43 / 0.5), 0 8px 24px -4px rgb(200 48 43 / 0.55), 0 0 48px -8px rgb(242 96 63 / 0.45)",
        "glow-gold": "0 0 0 1px rgb(224 174 78 / 0.45), 0 8px 24px -4px rgb(224 174 78 / 0.45)",
        "glow-green": "0 0 0 1px rgb(16 185 129 / 0.45), 0 8px 24px -4px rgb(16 185 129 / 0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #FF8266 0%, #C8302B 45%, #E0AE4E 100%)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "spin-slow": "spin-slow 14s linear infinite",
      },
    },
  },
  plugins: [],
};
