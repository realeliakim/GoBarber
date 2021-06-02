module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
    browser: true,
  },
  extends: ["airbnb-base", "prettier", "prettier/react"],
  plugins: ["prettier", "react", "jsx-a11y", "import", "react-hooks"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
    __DEV__: true
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: "module",
  },
  rules: {
    "prettier/prettier": "error",
    "class-methods-use-this": "off",
    "no-param-reassign": "off",
    camelcase: "off",
    "no-unused-vars": ["error", { argsIgnorePattern: "next" }],
  },
};
