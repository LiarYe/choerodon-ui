const base = require('./.jest');

module.exports = {
  ...base,
  setupFiles: ['./tests/mobxSetup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'md'],
  testRegex: '(mobx6-initialization|use-computed[/\\\\]__tests__[/\\\\]index)\\.test\\.js$',
};
