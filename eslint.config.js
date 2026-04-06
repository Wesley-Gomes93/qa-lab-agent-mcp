import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": "off",
      "no-useless-escape": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "test/fixtures/**", "learning-hub/**", "slack-bot/**", "curriculos/**"],
  },
];
