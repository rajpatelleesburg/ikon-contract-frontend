import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import babelParser from "@babel/eslint-parser";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],

    languageOptions: {
      parser: babelParser,

      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: "latest",
        sourceType: "module",

        babelOptions: {
          presets: ["@babel/preset-react"],
        },
      },

      globals: {
        // Browser
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        URLSearchParams: "readonly",

        // Node / Next.js
        process: "readonly",
        console: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },

    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },

    rules: {
      /* React */
      "react/react-in-jsx-scope": "off",
      "react/jsx-key": "error",
      "react/jsx-wrap-multilines": "error",

      /* Hooks */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      /* 🔒 Prevent the JSX bugs you hit */
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXExpressionContainer OptionalMemberExpression",
          message:
            "Do not use optional chaining inside JSX (breaks our toolchain)",
        },
      ],

      /* Next.js reality */
      "no-undef": "off",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },

    settings: {
      react: {
        version: "detect",
      },
    },
  },
];