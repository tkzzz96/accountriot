import next from "eslint-config-next";

export default [
  ...next,
  { ignores: [".next/**", "node_modules/**"] },
  {
    // React-Compiler-era rules flag patterns inherited from the Prospex base; kept as warnings.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
