// Tailwind CSS v4 base config — Story 1.5 adds full design token system
// Note: Tailwind v4 uses CSS-first configuration; this file provides shared content globs

export const baseConfig = {
  darkMode: "class" as const,
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      // Full design token extensions added in Story 1.5
    },
  },
  plugins: [] as unknown[],
};

export default baseConfig;
