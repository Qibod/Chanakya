// Tailwind CSS v4 base config — shared across apps/web and packages/ui Storybook

export const baseConfig = {
  darkMode: ["class", '[data-theme="dark"]'] as const,
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        "surface-base": "var(--surface-base)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-overlay": "var(--surface-overlay)",
        foreground: "var(--text-primary)",
        "foreground-secondary": "var(--text-secondary)",
        "foreground-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        border: "var(--border-default)",
        "border-subtle": "var(--border-subtle)",
        "status-pass": "var(--status-pass)",
        "status-warn": "var(--status-warn)",
        "status-fail": "var(--status-fail)",
        "status-pass-bg": "var(--status-pass-bg)",
        "status-warn-bg": "var(--status-warn-bg)",
        "status-fail-bg": "var(--status-fail-bg)",
      },
    },
  },
  plugins: [] as unknown[],
};

export default baseConfig;
