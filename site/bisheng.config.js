const path = require('path');
const legacy = require('./legacy-build/resolve');
const replaceLib = require('../tools/replaceLib');

const webpack = legacy.load('webpack');
const CSSSplitWebpackPlugin = legacy.load('css-split-webpack-plugin').default;
const NpmImportPlugin = legacy.load('less-plugin-npm-import');

const isDev = process.env.NODE_ENV === 'development';
const rcPath = path.join(legacy.root, 'components', 'rc-components');
const babelLoader = legacy.resolve('babel-loader');

function alertBabelConfig(rules) {
  rules.forEach(rule => {
    if (rule.loader === babelLoader || rule.loader === 'babel-loader') {
      if (rule.options.plugins.indexOf(replaceLib) === -1) {
        rule.options.plugins.push(replaceLib);
      }
      rule.options.plugins = rule.options.plugins.filter(
        plugin => !String(Array.isArray(plugin) ? plugin[0] : plugin).includes('babel-plugin-add-module-exports'),
      );
    }
    if (Array.isArray(rule.use)) {
      alertBabelConfig(rule.use);
    }
    if (rule.oneOf) {
      alertBabelConfig(rule.oneOf);
    }
    if (rule.rules) {
      alertBabelConfig(rule.rules);
    }
  });
}

module.exports = {
  port: 8899,
  hash: true,
  root: '/choerodon-ui/',
  source: {
    components: './components',
    'components-pro': './components-pro',
    docs: './docs',
    changelog: ['CHANGELOG.zh-CN.md', 'CHANGELOG.en-US.md'],
  },
  theme: './site/theme',
  htmlTemplate: './site/theme/static/template.html',
  themeConfig: {
    categoryOrder: {
      'Choerodon UI': 0,
      原则: 1,
      Principles: 1,
      视觉: 2,
      Visual: 2,
      模式: 3,
      Patterns: 3,
      其他: 6,
      Other: 6,
      'Pro Components': 99,
      Components: 100,
    },
    typeOrder: {
      Abstract: 0,
      General: 1,
      Layout: 2,
      Navigation: 3,
      'Data Entry': 4,
      'Data Display': 5,
      Feedback: 6,
      Localization: 7,
      Other: 8,
    },
  },
  filePathMapper(filePath) {
    if (filePath === '/index.html') {
      return ['/index.html', '/index-cn.html'];
    }
    if (filePath.endsWith('/index.html')) {
      return [filePath, filePath.replace(/\/index\.html$/, '-cn/index.html')];
    }
    if (filePath !== '/404.html' && filePath !== '/index-cn.html') {
      return [filePath, filePath.replace(/\.html$/, '-cn.html')];
    }
    return filePath;
  },
  doraConfig: {
    verbose: true,
  },
  lessConfig: {
    javascriptEnabled: true,
    plugins: [new NpmImportPlugin({ prefix: '~' })],
    // modifyVars: {
    //   // 'c7n-root-entry-name': 'variables',
    // },
  },
  webpackConfig(config) {
    config.context = legacy.root;
    config.resolve.modules = [path.join(legacy.root, 'node_modules'), legacy.nodeModules, ...config.resolve.modules];
    config.resolveLoader.modules = [legacy.nodeModules];
    config.resolveLoader.alias = { ...config.resolveLoader.alias, babel: babelLoader };
    config.resolve.alias = {
      ...config.resolve.alias,
      webpack: legacy.packageDirectory('webpack'),
      'choerodon-ui/dataset': path.resolve('components-dataset'),
      'choerodon-ui/shared': path.resolve('components-shared'),
      'choerodon-ui/pro/lib': path.resolve('components-pro'),
      'choerodon-ui/pro': path.resolve('index-pro'),
      'choerodon-ui/lib': path.resolve('components'),
      'choerodon-ui': path.resolve('index'),
      site: path.resolve('site'),
      'react-router': legacy.resolve('react-router/umd/ReactRouter'),
    };

    ['react', 'react-dom', 'mobx', 'mobx-react'].forEach(name => {
      config.resolve.alias[name] = path.dirname(require.resolve(`${name}/package.json`, { paths: [legacy.root] }));
    });

    config.externals = {
      'react-router-dom': 'ReactRouterDOM',
    };

    config.module.rules.forEach(rule => {
      if (rule.loader === babelLoader) {
        if (rule.exclude) {
          rule.exclude = [rule.exclude, rcPath];
        } else {
          rule.exclude = rcPath;
        }
      }
    });

    const rcComponentsRule = {
      test: /\.jsx?$/,
      include: [rcPath],
      loader: babelLoader,
      options: legacy.load('bisheng/lib/config/getBabelCommonConfig').default(),
    };

    config.module.rules.unshift(rcComponentsRule);

    alertBabelConfig(config.module.rules);

    rcComponentsRule.options.plugins.push(
      legacy.resolve('@babel/plugin-transform-proto-to-assign'),
      // [require.resolve('@babel/plugin-transform-classes'), { loose: true }],
    );

    config.plugins.push(
      new CSSSplitWebpackPlugin({ size: 4000 }),
      new webpack.DefinePlugin({
        'process.env.LOGGER_LEVEL': JSON.stringify('info'),
      }),
    );

    if (isDev) {
      config.devtool = '#source-map';
    }

    return config;
  },
};
