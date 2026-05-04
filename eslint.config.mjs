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
];

export default config;
