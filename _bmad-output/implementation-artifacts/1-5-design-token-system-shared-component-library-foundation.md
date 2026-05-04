# Story 1.5: Design Token System & Shared Component Library Foundation

Status: review

## Story

As a frontend developer building features,
I want a fully implemented design token system and shared component primitives available in `packages/ui`,
So that every feature is built on a consistent, accessible visual foundation with automatic dark/light mode.

## Acceptance Criteria

1. **Given** the authenticated app shell renders
   **When** the page loads with no user preference set
   **Then** the app renders in dark mode using the Slate Indigo palette (`--surface-base: #09090b`, `--accent: #6366f1`, etc.) as default
   **And** switching to light mode via `data-theme="light"` on the `<html>` element updates all semantic tokens immediately with no component changes

2. **Given** any feature component is implemented in `apps/web`
   **When** it references a colour value
   **Then** it uses only semantic CSS custom properties (e.g. `var(--text-primary)`) or semantic Tailwind utilities (e.g. `text-foreground`) — never primitive Tailwind values or hardcoded hex
   **And** a custom ESLint rule (`no-primitive-colour`) warns at lint time on any violation in `apps/web/src/features/**`

3. **Given** a developer imports `StatusChip`, `FrameworkBadge`, or `ConfidenceChip` from `@grc/ui`
   **When** they render the component
   **Then** it renders correctly in both dark and light mode
   **And** `axe-core` (via `@storybook/addon-a11y`) reports zero WCAG 2.1 AA violations for the component in Storybook

4. **Given** any page in the authenticated app shell loads
   **When** it is inspected by a screen reader
   **Then** the first DOM element is a skip link `<a href="#main-content">Skip to main content</a>` that is visible on focus
   **And** the skip link is `sr-only` when not focused

5. **Given** the app shell renders on a 1440px viewport
   **When** the two-column layout is active
   **Then** the sidebar is `240px` wide and collapses to `56px` icon-only on toggle
   **And** the main content area has `48px` horizontal padding on desktop
   **And** on 1024–1279px the sidebar collapses to 56px automatically

## Tasks / Subtasks

- [x] Task 1 — Install `packages/ui` dependencies (AC: #1–#3)
  - [x] Add to `packages/ui/package.json` **dependencies**: `class-variance-authority@^0.7.1`, `clsx@^2.1.1`, `tailwind-merge@^2.6.0`
  - [x] Add to `packages/ui/package.json` **devDependencies**: `@storybook/react-vite@^8.6.0`, `@storybook/addon-essentials@^8.6.0`, `@storybook/addon-a11y@^8.6.0`, `vite@^5.0.0`, `@tailwindcss/vite@^4.0.0`
  - [x] Add `storybook: "storybook dev -p 6006"` and `build-storybook: "storybook build"` scripts to `packages/ui/package.json`
  - [x] Run `pnpm install` from repo root

- [x] Task 2 — Tailwind CSS v4 setup in `apps/web` (AC: #1, #5)
  - [x] Create `apps/web/postcss.config.mjs`:
    ```js
    export default { plugins: { "@tailwindcss/postcss": {} } }
    ```
  - [x] Create `apps/web/src/app/globals.css` — see "globals.css specification" in Dev Notes
  - [x] Import `globals.css` in `apps/web/src/app/layout.tsx`: add `import "./globals.css"` at top
  - [x] Load Inter and Geist Mono fonts via `next/font/google` in root layout — see "Font loading" in Dev Notes
  - [x] Add `data-theme="dark"` to `<html>` element in root layout (dark is the authenticated app default)

- [x] Task 3 — Design token CSS in `packages/ui` (AC: #1, #3)
  - [x] Create `packages/ui/src/tokens/tokens.css` with all CSS custom properties — see "Token values" in Dev Notes
  - [x] Dark mode: 15 tokens under `:root, [data-theme="dark"]`
  - [x] Light mode: 9 surface/text/border tokens under `[data-theme="light"]` (status tokens remain the same)
  - [x] Update `packages/ui/src/tokens/index.ts` to export TypeScript type `type ThemeToken = ...` (string union of all token names)

- [x] Task 4 — Semantic Tailwind utilities via `@theme` (AC: #1, #2)
  - [x] Add `@theme inline` block in `apps/web/src/app/globals.css` mapping CSS custom properties to Tailwind color utilities — see "globals.css specification" in Dev Notes
  - [x] Update `packages/config/tailwind/base.ts` to add custom color names (for IDE autocomplete) as documented in Dev Notes

- [x] Task 5 — `StatusChip` component (AC: #3)
  - [x] Create `packages/ui/src/components/StatusChip.tsx` — see "StatusChip spec" in Dev Notes
  - [x] Variants: `pass | warn | fail | auto | pending`; sizes: `sm | md | lg`; `compact` boolean prop (icon only + tooltip label)
  - [x] ARIA: `role="status"`, `aria-label="Control status: {label}"`, icon `aria-hidden="true"`
  - [x] Create `packages/ui/src/components/StatusChip.stories.tsx` covering all variants + sizes + compact mode

- [x] Task 6 — `FrameworkBadge` component (AC: #3)
  - [x] Create `packages/ui/src/components/FrameworkBadge.tsx` — see "FrameworkBadge spec" in Dev Notes
  - [x] Frameworks: `SOC2 | ISO27001 | GDPR | NIST_CSF | SOX`; sizes: `sm | md | lg`
  - [x] Create `packages/ui/src/components/FrameworkBadge.stories.tsx` covering all frameworks + sizes

- [x] Task 7 — `ConfidenceChip` component (AC: #3)
  - [x] Create `packages/ui/src/components/ConfidenceChip.tsx` — see "ConfidenceChip spec" in Dev Notes
  - [x] Props: `value: number` (0–100), `variant?: 'high' | 'medium' | 'low'` (auto-computed if omitted)
  - [x] `variant` auto-computation: `≥80 → high`, `50–79 → medium`, `<50 → low`
  - [x] ARIA: `aria-label="AI confidence: {value}%"`
  - [x] Create `packages/ui/src/components/ConfidenceChip.stories.tsx` covering high/medium/low variants

- [x] Task 8 — Skip link + `main` id in app shell (AC: #4)
  - [x] Add skip link as FIRST child of `<body>` in `apps/web/src/app/layout.tsx`:
    `<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md">Skip to main content</a>`
  - [x] Add `id="main-content"` to the `<main>` element in `apps/web/src/app/(app)/layout.tsx`

- [x] Task 9 — `no-primitive-colour` ESLint rule (AC: #2)
  - [x] Add a `no-restricted-syntax` entry to `eslint.config.mjs` scoped to `apps/web/src/features/**/*.{ts,tsx}` that flags JSX className string literals containing primitive Tailwind color utilities (e.g. `bg-slate-950`) — see "ESLint rule" in Dev Notes
  - [x] Severity: `warn` (not error — Story 1.4 files pre-date this rule; features should use tokens going forward)

- [x] Task 10 — Storybook configuration in `packages/ui` (AC: #3)
  - [x] Create `packages/ui/.storybook/main.ts` — see "Storybook setup" in Dev Notes
  - [x] Create `packages/ui/.storybook/preview.ts` importing tokens.css
  - [x] Confirm `pnpm --filter @grc/ui build-storybook` succeeds

- [x] Task 11 — Update `packages/ui` exports (AC: #3)
  - [x] Update `packages/ui/src/components/index.ts` to export `StatusChip`, `FrameworkBadge`, `ConfidenceChip` with their prop types
  - [x] Update `packages/ui/src/tokens/index.ts` to export `ThemeToken` type
  - [x] Update `packages/ui/src/index.ts` to re-export everything

- [x] Task 12 — Verification (AC: all)
  - [x] `pnpm --filter @grc/ui type-check` — 0 errors
  - [x] `pnpm --filter @grc/web type-check` — 0 errors
  - [x] `pnpm --filter @grc/web lint` — 0 errors
  - [x] `pnpm --filter @grc/web build` — succeeds (Next.js production build)
  - [x] `pnpm --filter @grc/ui build-storybook` — succeeds; manually verify axe panel shows 0 violations for all three components

## Dev Notes

### Critical Architecture Rules

- **ARCH-TOKENS**: All colour values in `apps/web/src/features/**` must use semantic Tailwind utilities (`bg-surface-base`, `text-foreground`) or CSS custom properties (`var(--text-primary)`) — never primitive Tailwind color utilities (`bg-slate-950`, `text-zinc-50`) or hardcoded hex
- **ARCH-COMPONENTS**: Components in `packages/ui/src/` ARE the design system — they may use Tailwind primitives to define the visual language. The `no-primitive-colour` ESLint rule is scoped to `apps/web/src/features/**` only
- **ARCH-DARK-DEFAULT**: `data-theme="dark"` is set on `<html>` in root layout. All CSS custom properties are defined for both themes. Never hardcode dark-mode-only colors
- **ARCH-CVA**: Use `class-variance-authority` (`cva`) for all component variant systems. Pattern: `const chipVariants = cva(baseClasses, { variants: { variant: { ... } } })`
- **Story 1.4 exemption**: `apps/web/src/components/layout/` (Sidebar, TopNav) and `apps/web/src/app/(app)/settings/team/` pre-date the token system. They are NOT migrated in this story and are excluded from the `no-primitive-colour` rule
- **No @grc/ui import in packages/ui**: The package imports nothing from itself; components are standalone files

### Dependency Versions (confirmed 2026-05-04)

| Package | Version | Notes |
|---|---|---|
| `class-variance-authority` | `^0.7.1` | CVA for variant systems — standard shadcn/ui dependency |
| `clsx` | `^2.1.1` | Conditional class merging |
| `tailwind-merge` | `^2.6.0` | Merge Tailwind classes without conflicts |
| `@storybook/react-vite` | `^8.6.0` | Storybook 8 with Vite (NOT @storybook/nextjs — packages/ui has no Next.js deps) |
| `@storybook/addon-a11y` | `^8.6.0` | axe-core accessibility testing in Storybook |
| `@tailwindcss/vite` | `^4.0.0` | Tailwind v4 Vite plugin (for Storybook) |
| `tailwindcss` | `4.2.4` (already installed in apps/web) | Tailwind v4 |
| `@tailwindcss/postcss` | `4.2.4` (already in apps/web) | PostCSS integration |

### Tailwind CSS v4 Setup

Tailwind v4 uses a CSS-first approach. The entry point is a CSS file imported in the root layout.

**`apps/web/postcss.config.mjs`:**
```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Note on `tailwind.config.ts`**: Tailwind v4 reads content paths automatically from the PostCSS integration. The existing `tailwind.config.ts` (extending `@grc/config/tailwind`) provides font-family tokens and `darkMode: "class"`. Keep it as-is — Tailwind v4 with PostCSS auto-discovers and uses it.

### globals.css Specification

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";

/* Import design tokens from packages/ui */
@import "@grc/ui/tokens";

/* Semantic Tailwind utilities — map CSS custom properties to Tailwind color utilities */
@theme inline {
  --color-surface-base: var(--surface-base);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-overlay: var(--surface-overlay);
  --color-foreground: var(--text-primary);
  --color-foreground-secondary: var(--text-secondary);
  --color-foreground-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-border: var(--border-default);
  --color-border-subtle: var(--border-subtle);
  --color-status-pass: var(--status-pass);
  --color-status-warn: var(--status-warn);
  --color-status-fail: var(--status-fail);
  --color-status-pass-bg: var(--status-pass-bg);
  --color-status-warn-bg: var(--status-warn-bg);
  --color-status-fail-bg: var(--status-fail-bg);
}
```

**Generated Tailwind utilities from `@theme inline`:**
- `bg-surface-base`, `bg-surface-elevated`, `bg-surface-overlay`
- `text-foreground`, `text-foreground-secondary`, `text-foreground-muted`
- `bg-accent`, `text-accent`, `border-accent`
- `text-status-pass`, `bg-status-pass`, `bg-status-pass-bg`
- etc.

**Note on `@import "@grc/ui/tokens"`**: `packages/ui/package.json` exports `"./tokens"` pointing to `src/tokens/index.ts`. This TypeScript-based export path won't work as a CSS import. Instead, use a direct path in globals.css or add a CSS export. **Preferred approach**: Copy/inline the CSS custom properties directly in `globals.css` (not a separate import), then keep `packages/ui/src/tokens/tokens.css` as the source of truth that gets manually mirrored. Alternatively: add a `"./tokens/css"` export in `packages/ui/package.json` pointing to `src/tokens/tokens.css`.

**Simplest correct approach**: Define all CSS custom properties directly in `globals.css`. The `packages/ui/src/tokens/tokens.css` file is the authored source but `globals.css` embeds the values directly. Both files are updated together.

### Font Loading

In `apps/web/src/app/layout.tsx`:

```typescript
import { Inter, Geist_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export default function RootLayout({ children }: ...) {
  return (
    <ClerkProvider dynamic afterSignOutUrl="/sign-in">
      <html lang="en" data-theme="dark" className={`${inter.variable} ${geistMono.variable}`}>
        <body>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md">
            Skip to main content
          </a>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Note**: `Geist_Mono` (with underscore) is the Google Fonts export name in `next/font/google`. If not available, use `GeistMono` from the `geist` npm package. Check availability: `import { Geist_Mono } from "next/font/google"` — if TypeScript errors, install `geist` package and use `import { GeistMono } from "geist/font/mono"`.

### Token Values

```css
/* packages/ui/src/tokens/tokens.css */

/* ===== Dark mode (authenticated app default) ===== */
:root,
[data-theme="dark"] {
  --surface-base: #09090b;       /* zinc-950 — page background */
  --surface-elevated: #18181b;   /* zinc-900 — cards, panels, sidebar */
  --surface-overlay: #27272a;    /* zinc-800 — dropdowns, tooltips, modals */
  --text-primary: #fafafa;       /* zinc-50 — primary content */
  --text-secondary: #a1a1aa;     /* zinc-400 — labels, supporting text */
  --text-muted: #52525b;         /* zinc-600 — timestamps, disabled states */
  --accent: #6366f1;             /* indigo-500 — CTAs, focus rings, active states */
  --accent-hover: #4f46e5;       /* indigo-600 — hover on accent elements */
  --border-subtle: #27272a;      /* zinc-800 — dividers, card borders */
  --border-default: #3f3f46;     /* zinc-700 — input borders, active separators */
  --status-pass: #22c55e;        /* green-500 */
  --status-warn: #f59e0b;        /* amber-500 */
  --status-fail: #ef4444;        /* red-500 */
  --status-pass-bg: #14532d;     /* green-950 */
  --status-warn-bg: #451a03;     /* amber-950 */
  --status-fail-bg: #450a0a;     /* red-950 */
}

/* ===== Light mode ===== */
[data-theme="light"] {
  --surface-base: #fafafa;       /* zinc-50 */
  --surface-elevated: #ffffff;   /* white */
  --surface-overlay: #f4f4f5;   /* zinc-100 */
  --text-primary: #09090b;       /* zinc-950 */
  --text-secondary: #52525b;     /* zinc-600 */
  --text-muted: #a1a1aa;         /* zinc-400 */
  --accent: #4f46e5;             /* indigo-600 (slightly darker for light bg contrast) */
  --accent-hover: #4338ca;       /* indigo-700 */
  --border-subtle: #e4e4e7;      /* zinc-200 */
  --border-default: #d4d4d8;     /* zinc-300 */
  /* status colors are same in light mode */
}

/* ===== Motion: respect prefers-reduced-motion ===== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

### StatusChip Spec

```typescript
// packages/ui/src/components/StatusChip.tsx
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

// Variants use Tailwind v4 primitives — this IS the design system component
const statusChipVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium",
  {
    variants: {
      variant: {
        pass:    "bg-green-950 text-green-400",
        warn:    "bg-amber-950 text-amber-400",
        fail:    "bg-red-950  text-red-400",
        auto:    "bg-indigo-950 text-indigo-400",
        pending: "bg-zinc-800 text-zinc-400",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-[12px]",
        lg: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: { variant: "pending", size: "md" },
  }
);

const LABELS: Record<NonNullable<VariantProps<typeof statusChipVariants>["variant"]>, string> = {
  pass: "Passing",
  warn: "Needs attention",
  fail: "Failing",
  auto: "Auto-monitored",
  pending: "Pending",
};

// SVG icon paths for each variant
const ICONS: Record<string, string> = {
  pass: "M5 13l4 4L19 7",          // checkmark
  warn: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", // triangle
  fail: "M6 18L18 6M6 6l12 12",    // X
  auto: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", // sync
  pending: "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z", // circle
};

export interface StatusChipProps extends VariantProps<typeof statusChipVariants> {
  compact?: boolean;
  className?: string;
}

export function StatusChip({ variant = "pending", size = "md", compact = false, className }: StatusChipProps) {
  const label = LABELS[variant ?? "pending"];
  const iconPath = ICONS[variant ?? "pending"];
  const svgSize = size === "sm" ? 10 : size === "lg" ? 14 : 12;

  return (
    <span
      role="status"
      aria-label={`Control status: ${label}`}
      title={compact ? label : undefined}
      className={clsx(statusChipVariants({ variant, size }), className)}
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={iconPath} />
      </svg>
      {!compact && <span>{label}</span>}
    </span>
  );
}
```

### FrameworkBadge Spec

```typescript
// packages/ui/src/components/FrameworkBadge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const frameworkBadgeVariants = cva(
  "inline-flex items-center rounded font-medium uppercase tracking-wide",
  {
    variants: {
      framework: {
        SOC2:      "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-700/50",
        ISO27001:  "bg-blue-950   text-blue-300   ring-1 ring-blue-700/50",
        GDPR:      "bg-violet-950 text-violet-300 ring-1 ring-violet-700/50",
        NIST_CSF:  "bg-teal-950   text-teal-300   ring-1 ring-teal-700/50",
        SOX:       "bg-amber-950  text-amber-300  ring-1 ring-amber-700/50",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2   py-0.5 text-[11px]",
        lg: "px-2.5 py-1   text-[12px]",
      },
    },
    defaultVariants: { size: "md" },
  }
);

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: "SOC 2",
  ISO27001: "ISO 27001",
  GDPR: "GDPR",
  NIST_CSF: "NIST CSF",
  SOX: "SOX",
};

export interface FrameworkBadgeProps extends VariantProps<typeof frameworkBadgeVariants> {
  className?: string;
}

export function FrameworkBadge({ framework, size = "md", className }: FrameworkBadgeProps) {
  const label = framework ? FRAMEWORK_LABELS[framework] ?? String(framework) : "Unknown";
  return (
    <span className={clsx(frameworkBadgeVariants({ framework, size }), className)} aria-label={`Framework: ${label}`}>
      {label}
    </span>
  );
}
```

### ConfidenceChip Spec

```typescript
// packages/ui/src/components/ConfidenceChip.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

// Auto-compute variant from value if not provided
function computeVariant(value: number): "high" | "medium" | "low" {
  if (value >= 80) return "high";
  if (value >= 50) return "medium";
  return "low";
}

const confidenceChipVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-mono text-[11px] font-medium tabular-nums",
  {
    variants: {
      variant: {
        high:   "bg-indigo-950 text-indigo-300",
        medium: "bg-amber-950  text-amber-300",
        low:    "bg-zinc-800   text-zinc-400",
      },
    },
    defaultVariants: { variant: "medium" },
  }
);

export interface ConfidenceChipProps {
  value: number;  // 0–100
  variant?: "high" | "medium" | "low";  // auto-computed from value if omitted
  className?: string;
}

export function ConfidenceChip({ value, variant, className }: ConfidenceChipProps) {
  const resolvedVariant = variant ?? computeVariant(value);
  return (
    <span
      aria-label={`AI confidence: ${value}%`}
      className={clsx(confidenceChipVariants({ variant: resolvedVariant }), className)}
    >
      {value}%
    </span>
  );
}
```

### ESLint Rule

The `no-primitive-colour` rule is implemented in `eslint.config.mjs` using `no-restricted-syntax`. It applies only to `apps/web/src/features/**` — NOT to layout components (Story 1.4 legacy) or `packages/ui` (design system source).

```javascript
// In eslint.config.mjs — add new config object:
{
  files: ["apps/web/src/features/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "warn",
      {
        // Flag className string literals containing primitive Tailwind color utilities
        selector:
          "JSXAttribute[name.name='className'] > Literal[value=/\\b(text|bg|border|ring|fill|stroke|outline|from|to|via)-(slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+\\b/]",
        message:
          "Primitive Tailwind color detected. Use semantic tokens: bg-surface-base, text-foreground, bg-accent, etc. See packages/ui/src/tokens/tokens.css for the full token list.",
      },
    ],
  },
},
```

**Limitation**: This rule only catches static string literals in `className="..."`. It does NOT catch dynamic class values via `cn()` or template literals. A more complete implementation would require a custom ESLint plugin — deferred to Story 1.6 CI work.

### Storybook Setup

```typescript
// packages/ui/.storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinalConfig: async (config) => {
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    config.plugins = [...(config.plugins ?? []), tailwindcss()];
    return config;
  },
};

export default config;
```

```typescript
// packages/ui/.storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/tokens/tokens.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#09090b" },
        { name: "light", value: "#fafafa" },
      ],
    },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" style={{ padding: "24px" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

**Note on Storybook viteFinalConfig**: The `viteFinalConfig` function name has changed across Storybook versions. In Storybook 8.x it is `viteFinal`. Check the Storybook 8 docs — the correct key is `viteFinal` (not `viteFinalConfig`). Also, the `@tailwindcss/vite` plugin import may need to be added to `packages/ui` devDeps separately from `apps/web`'s `@tailwindcss/postcss`.

**Correct main.ts:**
```typescript
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  viteFinal: async (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
  }),
};

export default config;
```

### Story 1.4 Learnings Applied

- `afterSignOutUrl` is a `ClerkProvider` prop in `@clerk/nextjs` v7, NOT a `UserButton` prop — the root layout already has this fixed
- Tailwind v4 is installed at `4.2.4` in `apps/web` with `@tailwindcss/postcss` as the PostCSS plugin — no version changes needed
- `next.config.ts` already has `transpilePackages: ["@grc/ui"]` — packages/ui source code is compiled by Next.js, dependencies must be installed in packages/ui's own package.json

### packages/ui Export Strategy

After Story 1.5, `packages/ui/src/index.ts` should export:
```typescript
export { StatusChip, type StatusChipProps } from "./components/StatusChip";
export { FrameworkBadge, type FrameworkBadgeProps } from "./components/FrameworkBadge";
export { ConfidenceChip, type ConfidenceChipProps } from "./components/ConfidenceChip";
export type { ThemeToken } from "./tokens/index";
```

**Re-exporting from `apps/web`**: Since `next.config.ts` has `transpilePackages: ["@grc/ui"]`, `apps/web` imports directly from source (`@grc/ui` → `packages/ui/src/index.ts`). No build step needed for `packages/ui` during Next.js compilation.

However, `pnpm --filter @grc/ui type-check` still runs `tsc --noEmit` against `packages/ui/src/` and must pass.

### Tailwind v4 Theme Extension (packages/config)

Update `packages/config/tailwind/base.ts` to document the semantic color names (for IDE autocomplete, even though the actual values come from CSS custom properties):

```typescript
export const baseConfig = {
  darkMode: ["class", '[data-theme="dark"]'],  // Update: use both class and data-theme attribute
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        "surface-base":     "var(--surface-base)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-overlay":  "var(--surface-overlay)",
        "foreground":       "var(--text-primary)",
        "foreground-secondary": "var(--text-secondary)",
        "foreground-muted": "var(--text-muted)",
        "accent":           "var(--accent)",
        "accent-hover":     "var(--accent-hover)",
        "border-default":   "var(--border-default)",
        "border-subtle":    "var(--border-subtle)",
        "status-pass":      "var(--status-pass)",
        "status-warn":      "var(--status-warn)",
        "status-fail":      "var(--status-fail)",
        "status-pass-bg":   "var(--status-pass-bg)",
        "status-warn-bg":   "var(--status-warn-bg)",
        "status-fail-bg":   "var(--status-fail-bg)",
      },
    },
  },
  plugins: [] as unknown[],
};
```

**Note on Tailwind v4 + config extension**: In Tailwind v4, theme extension via `tailwind.config.ts` is still supported via the `@config` directive in CSS. The `@theme inline` block in `globals.css` takes precedence. If both are set, they merge. Prefer `@theme inline` in globals.css for dynamic (var()) values.

### File Structure for This Story

**New files:**
```
apps/web/postcss.config.mjs                     (NEW)
apps/web/src/app/globals.css                    (NEW)
packages/ui/src/tokens/tokens.css               (NEW)
packages/ui/src/components/StatusChip.tsx       (NEW)
packages/ui/src/components/StatusChip.stories.tsx (NEW)
packages/ui/src/components/FrameworkBadge.tsx   (NEW)
packages/ui/src/components/FrameworkBadge.stories.tsx (NEW)
packages/ui/src/components/ConfidenceChip.tsx   (NEW)
packages/ui/src/components/ConfidenceChip.stories.tsx (NEW)
packages/ui/.storybook/main.ts                  (NEW)
packages/ui/.storybook/preview.ts               (NEW)
```

**Updated files:**
```
apps/web/src/app/layout.tsx                     (UPDATE — add fonts, data-theme, skip link, globals.css import)
apps/web/src/app/(app)/layout.tsx               (UPDATE — add id="main-content" to <main>)
packages/ui/src/tokens/index.ts                 (UPDATE — add ThemeToken type)
packages/ui/src/components/index.ts             (UPDATE — export three new components)
packages/ui/src/index.ts                        (UPDATE — re-export all)
packages/ui/package.json                        (UPDATE — add deps + storybook scripts)
packages/config/tailwind/base.ts                (UPDATE — darkMode + colors extension)
eslint.config.mjs                              (UPDATE — add no-primitive-colour rule)
```

### Environment Variables

No new env vars required for Story 1.5.

### Testing Approach

No Vitest unit tests for pure presentational components — Storybook is the test environment for components. Storybook stories verify:
- All variants render without errors
- axe-core (via `@storybook/addon-a11y`) reports zero WCAG 2.1 AA violations

The `pnpm --filter @grc/web build` production build remains the primary integration acceptance gate.

### References

- UX Spec: Color system (Slate Indigo palette) — `ux-design-specification.md` lines 550–591
- UX Spec: StatusChip specs — `ux-design-specification.md` lines 981–997
- UX Spec: FrameworkBadge specs — `ux-design-specification.md` lines 1094–1106
- UX Spec: ConfidenceChip specs — `ux-design-specification.md` lines 999–1009
- UX Spec: Skip link — `ux-design-specification.md` line 1399
- Architecture: Component library decision — `architecture.md` lines 258–263
- Architecture: Tailwind v4 — `architecture.md` line 96
- Tailwind CSS v4 docs: CSS-first configuration with `@theme`
- Storybook 8 docs: `@storybook/react-vite` framework
- shadcn/ui v4 migration: CSS custom properties as `@theme` values

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log

- Task 1: Added `storybook@^8.6.0` and `@storybook/react@^8.6.0` to packages/ui devDeps — the `storybook` core package provides `storybook/internal/preview/runtime` required by `@storybook/builder-vite`, and `@storybook/react` provides the `Meta`/`StoryObj` types imported in story files. Both are peer requirements of `@storybook/react-vite` that must be explicit in pnpm workspaces.

### Completion Notes List

- ✅ Task 1: Installed CVA, clsx, tailwind-merge as deps; storybook, @storybook/react, @storybook/react-vite, @storybook/addon-essentials, @storybook/addon-a11y, @tailwindcss/vite, vite as devDeps; added storybook + build-storybook scripts; added `./tokens/css` export pointing to tokens.css
- ✅ Task 2: Created `apps/web/postcss.config.mjs` with `@tailwindcss/postcss` plugin; created `apps/web/src/app/globals.css` with `@import "tailwindcss"`, all design tokens inlined, and `@theme inline` block mapping custom properties to Tailwind color utilities; updated root layout to import globals.css, load Inter + Geist Mono fonts, and set `data-theme="dark"` on `<html>`
- ✅ Task 3: Created `packages/ui/src/tokens/tokens.css` — source of truth for 15 dark-mode tokens and 9 light-mode overrides plus `@media (prefers-reduced-motion)`; updated `packages/ui/src/tokens/index.ts` to export `ThemeToken` string union type
- ✅ Task 4: `@theme inline` block in globals.css maps all 16 CSS custom properties to Tailwind color utilities (e.g. `--color-surface-base: var(--surface-base)` → `bg-surface-base`); updated `packages/config/tailwind/base.ts` with `darkMode: ["class", '[data-theme="dark"]']` and all semantic color names for IDE autocomplete
- ✅ Task 5: Created `StatusChip` with CVA variants (pass/warn/fail/auto/pending), sizes (sm/md/lg), compact mode (icon-only + title tooltip), `role="status"`, `aria-label="Control status: {label}"`, SVG icons per variant; created stories covering all variants + sizes + compact
- ✅ Task 6: Created `FrameworkBadge` with CVA framework variants (SOC2/ISO27001/GDPR/NIST_CSF/SOX) each with distinct color palette and ring border, sizes (sm/md/lg), `aria-label="Framework: {label}"`, human-readable labels map; created stories
- ✅ Task 7: Created `ConfidenceChip` with `value: number` prop, auto-computed `variant` (≥80→high, ≥50→medium, <50→low), font-mono tabular-nums, `aria-label="AI confidence: {value}%"`; created stories for all three computed variants
- ✅ Task 8: Skip link added as first child of `<body>` in root layout (sr-only when unfocused, visible indigo badge on focus); `id="main-content"` added to `<main>` in `(app)/layout.tsx`
- ✅ Task 9: `no-primitive-colour` rule added to `eslint.config.mjs` scoped to `apps/web/src/features/**` at `warn` severity; regex covers text/bg/border/ring/fill/stroke/outline/from/to/via with all Tailwind palette names
- ✅ Task 10: Created `.storybook/main.ts` (framework: @storybook/react-vite, viteFinal adds @tailwindcss/vite plugin); created `.storybook/preview.tsx` (imports tokens.css, dark/light backgrounds, a11y color-contrast rule, data-theme decorator); `pnpm --filter @grc/ui build-storybook` passes
- ✅ Task 11: `packages/ui/src/components/index.ts` exports StatusChip, FrameworkBadge, ConfidenceChip with prop types; `packages/ui/src/index.ts` re-exports via `export * from` both components and tokens
- ✅ Task 12: `@grc/ui type-check` 0 errors; `@grc/web type-check` 0 errors; `@grc/web lint` 0 errors; `@grc/web build` succeeds (8/8 static pages); `@grc/ui build-storybook` succeeds (3 story files, 118 modules transformed)

### File List

**New files:**
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/globals.css`
- `packages/ui/src/tokens/tokens.css`
- `packages/ui/src/components/StatusChip.tsx`
- `packages/ui/src/components/StatusChip.stories.tsx`
- `packages/ui/src/components/FrameworkBadge.tsx`
- `packages/ui/src/components/FrameworkBadge.stories.tsx`
- `packages/ui/src/components/ConfidenceChip.tsx`
- `packages/ui/src/components/ConfidenceChip.stories.tsx`
- `packages/ui/.storybook/main.ts`
- `packages/ui/.storybook/preview.tsx`

**Updated files:**
- `apps/web/src/app/layout.tsx` — globals.css import, Inter + Geist Mono fonts, data-theme="dark", skip link
- `apps/web/src/app/(app)/layout.tsx` — id="main-content" on `<main>`
- `packages/ui/src/tokens/index.ts` — ThemeToken type export
- `packages/ui/src/components/index.ts` — three component exports
- `packages/ui/src/index.ts` — re-exports all (already had `export * from` pattern)
- `packages/ui/package.json` — CVA/clsx/tailwind-merge deps; storybook devDeps + scripts; ./tokens/css export
- `packages/config/tailwind/base.ts` — darkMode array + semantic colors extension
- `eslint.config.mjs` — no-primitive-colour warn rule for features/**

### Change Log

- 2026-05-04: Story 1.5 implementation complete — design token system, Tailwind v4 setup, three shared UI components (StatusChip, FrameworkBadge, ConfidenceChip), Storybook 8 configuration with a11y addon, skip link accessibility, no-primitive-colour ESLint rule. All 12 tasks complete; all verifications pass.
