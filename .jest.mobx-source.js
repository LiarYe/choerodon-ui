const base = require('./.jest.components');

module.exports = {
  ...base,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^choerodon-ui$': '<rootDir>/components/index.tsx',
    '^choerodon-ui/es$': '<rootDir>/components/index.tsx',
    '^choerodon-ui/es/(.*)$': '<rootDir>/components/$1',
    '^choerodon-ui/pro$': '<rootDir>/components-pro/index.tsx',
    '^choerodon-ui/pro/es$': '<rootDir>/components-pro/index.tsx',
    '^choerodon-ui/pro/es/(.*)$': '<rootDir>/components-pro/$1',
  },
};
