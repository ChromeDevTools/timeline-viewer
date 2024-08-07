module.exports = {
  // start with google standard style
  //     https://github.com/google/eslint-config-google/blob/master/index.js
  "extends": ["eslint:recommended", "google"],
  "env": {
    "browser": true,
    "es6": true,
    "cypress/globals": true,
  },
  "plugins": [
    "cypress"
  ],
  "globals": {
    gapi: true,
    Bindings: true,
    Common: true,
    legacy: true,
    DevTools: true,
    GoogleAuth: true,
    GoogleDrive: true,
    PerfUI: true,
    Runtime: true,
    SyncView: true,
    Timeline: true,
    UI: true,
    Utils: true,
    Viewer: true,
  },
  "rules": {
    // 2 == error, 1 == warning, 0 == off
    "indent": [2, 2, {
      "SwitchCase": 1,
      "VariableDeclarator": 2
    }],
    "max-len": [1, 120, {
      "ignoreComments": true,
      "ignoreUrls": true,
      "tabWidth": 2
    }],
    "no-empty": [2, {
      "allowEmptyCatch": true
    }],
    "no-implicit-coercion": [2, {
      "boolean": false,
      "number": true,
      "string": true
    }],
    "no-unused-expressions": [1, {
      "allowShortCircuit": true,
      "allowTernary": false
    }],
    "no-unused-vars": [2, {
      "vars": "all",
      "args": "after-used",
      "argsIgnorePattern": "(^reject$|^_$)",
      "varsIgnorePattern": "(^_$)"
    }],
    "quotes": [2, "single"],
    "strict": [2, "global"],
    "prefer-const": 2,

    // Disabled rules
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
    "comma-dangle": 0,
    "arrow-parens": 0,
    "no-undef": 1,
    "no-console": 0,
    "no-invalid-this": 1,
  },
  "parserOptions": {
    "ecmaVersion": 2018,
    "ecmaFeatures": {
      "globalReturn": true,
      "jsx": false,
      "experimentalObjectRestSpread": false
    },
    "sourceType": "script"
  }
}
