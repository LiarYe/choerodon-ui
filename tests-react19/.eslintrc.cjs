module.exports = {
  overrides: [{
    files: ['cases/**/*.{ts,tsx}', 'preview/**/*.{ts,tsx}'],
    extends: ['plugin:react/jsx-runtime'],
    parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
    settings: { react: { version: '19.3' } },
  }, {
    files: ['cases/**/*.{ts,tsx}', 'preview/**/*.{jsx,ts,tsx}'],
    rules: {
      // Exercise repository sources rather than the published package.
      'import/no-relative-packages': ['error', { ignore: ['^(?:\\.\\./)+components(?:-pro|-shared|-dataset)?/'] }],
    },
  }],
};
