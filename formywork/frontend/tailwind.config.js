/** Couleurs : voir src/styles/tokens.css (thème clair et sombre). */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        sand: v("sand"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        accent: v("accent"),
        "accent-strong": v("accent-strong"),
        "on-accent": v("on-accent"),
        primary: v("primary"),
        "on-primary": v("on-primary"),
        success: v("success"),
        danger: v("danger"),
        warning: v("warning"),
        info: v("info"),
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"DM Sans Variable"', "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(20 38 74 / 0.05), 0 8px 24px -12px rgb(20 38 74 / 0.18)",
        lift: "0 2px 4px rgb(20 38 74 / 0.06), 0 18px 40px -18px rgb(20 38 74 / 0.30)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        "pulse-soft": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.55 } },
      },
      animation: {
        "fade-up": "fade-up 320ms cubic-bezier(.2,.7,.2,1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
