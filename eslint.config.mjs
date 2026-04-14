import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import preferArrow from "eslint-plugin-prefer-arrow";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      "prefer-arrow": preferArrow,
    },
    settings: {
      next: {
        rootDir: ["."],
      },
    },
    rules: {
      "prefer-arrow/prefer-arrow-functions": [
        "warn",
        {
          allowStandaloneDeclarations: true,
          classPropertiesAllowed: false,
          disallowPrototype: false,
          singleReturnOnly: false,
        },
      ],
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "generated/**",
    "**/next-env.d.ts",
  ]),
  eslintConfigPrettier,
]);

export default eslintConfig;
