import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".turbo/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["packages/mydrop-core/src/**/*.ts", "packages/mydrop-core/src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "@mydrop/core must remain independent of React.",
            },
            {
              name: "react-native",
              message: "React Native integrations belong in @mydrop/mobile.",
            },
          ],
          patterns: [
            {
              group: ["react/*"],
              message: "@mydrop/core must remain independent of React.",
            },
            {
              group: ["react-native/*"],
              message: "React Native integrations belong in @mydrop/mobile.",
            },
            {
              group: ["@tauri-apps", "@tauri-apps/*"],
              message: "Tauri integrations belong in @mydrop/desktop.",
            },
          ],
        },
      ],
    },
  },
  {
    // The React Native package uses conditional native declarations that ESLint's
    // project service cannot resolve, although tsc validates this adapter.
    files: [
      "packages/mydrop-mobile/src/App.tsx",
      "packages/mydrop-mobile/src/db/op-sqlite-adapter.ts",
    ],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
);
