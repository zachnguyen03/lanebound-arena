/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        field: "var(--c-field)",
        panel: "var(--c-panel)",
        text: "var(--c-text)",
        dim: "var(--c-dim)",
        action: "var(--c-action)",
        line: "var(--c-line)",
        good: "var(--c-good)",
        bad: "var(--c-bad)",
        blue: "var(--c-blue)",
        red: "var(--c-red)",
      },
      fontFamily: {
        display: "var(--f-display)",
        ui: "var(--f-ui)",
        mono: "var(--f-mono)",
      },
    },
  },
};
