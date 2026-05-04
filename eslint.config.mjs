// @ts-check
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      "_bmad/**",
      "_bmad-output/**",
      "infra/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "warn",
      // ARCH-2: tenant always from request.tenant (middleware-set) — never URL params
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='request'][object.property.name='params'][property.name='tenantId']",
          message:
            "Use request.tenant (set by tenant middleware) — never resolve tenant from URL params (ARCH-2)",
        },
      ],
    },
  },
  // no-primitive-colour: warn on raw Tailwind color utilities in feature code
  // Story 1.4 layout components and packages/ui (design system) are excluded.
  // Scope: apps/web/src/features/** only (new feature code going forward).
  {
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXAttribute[name.name='className'] > Literal[value=/\\b(text|bg|border|ring|fill|stroke|outline|from|to|via)-(slate|zinc|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+\\b/]",
          message:
            "Primitive Tailwind color detected. Use semantic tokens: bg-surface-base, text-foreground, bg-accent, etc. (ARCH-TOKENS)",
        },
      ],
    },
  },
];

export default config;
