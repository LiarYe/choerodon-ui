const base = require('./.jest.mobx');

module.exports = {
  ...base,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^choerodon-ui/lib$': '<rootDir>/components/index.tsx',
    '^choerodon-ui/lib/(.*)$': '<rootDir>/components/$1',
    '^choerodon-ui/pro/lib$': '<rootDir>/components-pro/index.tsx',
    '^choerodon-ui/pro/lib/(.*)$': '<rootDir>/components-pro/$1',
    '^choerodon-ui/shared$': '<rootDir>/components-shared/index.ts',
    '^choerodon-ui/shared/(.*)$': '<rootDir>/components-shared/$1',
  },
  testRegex: '.*\\.test\\.js$',
};
