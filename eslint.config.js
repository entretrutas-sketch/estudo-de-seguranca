// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // TypeScript path aliases are validated by tsc; eslint-import-resolver is not installed.
      "import/no-unresolved": "off",
      // A few Expo template compatibility hooks intentionally synchronize cached state.
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
