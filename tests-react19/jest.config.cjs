module.exports = {
  roots: ['<rootDir>/cases'],
  testMatch: ['**/*.test.[jt]s?(x)'],
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/../components/configure/index.tsx'],
  // Apply to imports from repository source as well as imports from the tests.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^choerodon-ui/pro/lib/(.*)$': '<rootDir>/../components-pro/$1',
    '^choerodon-ui/lib/(.*)$': '<rootDir>/../components/$1',
    '^choerodon-ui/shared/(.*)$': '<rootDir>/../components-shared/$1',
    '^choerodon-ui/shared$': '<rootDir>/../components-shared/index.ts',
    '^choerodon-ui/dataset$': '<rootDir>/../components-dataset/index.ts',
    '^choerodon-ui/dataset/(.*)$': '<rootDir>/../components-dataset/$1',
    '^react-intersection-observer$': '<rootDir>/node_modules/react-intersection-observer',
    '^(react|react-dom)(/.*)?$': '<rootDir>/node_modules/$1$2',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['@swc/jest', {
      swcrc: false,
      jsc: {
        parser: { syntax: 'typescript', tsx: true, decorators: true },
        transform: { legacyDecorator: true, react: { runtime: 'automatic' } },
      },
    }],
  },
};
