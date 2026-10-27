'use strict';
const runtimeVersion = require('@babel/runtime/package.json').version;
const { resolve, isThereHaveBrowserslistConfig } = require('./utils/projectHelper');

module.exports = function(modules = 'commonjs') {
  const plugins = [
    [
      resolve('@babel/plugin-transform-typescript'),
      {
        isTSX: true,
      },
    ],
    // resolve('babel-plugin-inline-import-data-uri'),
    [resolve('@babel/plugin-transform-runtime'), { version: runtimeVersion }],
    resolve('@babel/plugin-proposal-export-default-from'),
    resolve('@babel/plugin-transform-export-namespace-from'),
    resolve('@babel/plugin-transform-object-rest-spread'),
    [
      resolve('@babel/plugin-proposal-decorators'),
      {
        version: 'legacy',
      },
    ],
    resolve('@babel/plugin-transform-class-properties'),
  ];
  return {
    presets: [
      [resolve('@babel/preset-react'), { runtime: 'classic' }],
      [
        resolve('@babel/preset-env'),
        {
          modules,
          bugfixes: true,
          targets: isThereHaveBrowserslistConfig()
            ? undefined
            : {
              browsers: ['> 0.5%', 'last 2 versions', 'Firefox ESR', 'not dead'],
            },
        },
      ],
    ],
    plugins,
  };
};
