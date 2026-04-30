export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        iina: "readonly",
        global: "readonly",
        core: "readonly",
        mpv: "readonly",
        event: "readonly",
        sidebar: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off"
    }
  }
];
