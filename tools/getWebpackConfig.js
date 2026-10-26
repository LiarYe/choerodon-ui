const { getProjectPath, resolve, injectRequire } = require('./utils/projectHelper'); // eslint-disable-line import/order

injectRequire();

// Show warning for webpack
process.traceDeprecation = true;

// Normal requirement
const webpack = require('webpack');
const { merge: webpackMerge } = require('webpack-merge');
const TerserJSPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const postcssConfig = require('./postcssConfig');
const lessImplementation = require('./lessImplementation');

const limit = 10000;
const svgRegex = /\.svg(\?v=\d+\.\d+\.\d+)?$/;
const svgOptions = {
  limit,
  mimetype: 'image/svg+xml',
};

const imageOptions = {
  limit,
};

function getAssetRule(test, mimetype) {
  return {
    test,
    type: 'asset',
    parser: { dataUrlCondition: { maxSize: limit } },
    generator: {
      filename: '[name].[hash:8][ext]',
      ...(mimetype ? { dataUrl: { mimetype, encoding: 'base64' } } : {}),
    },
  };
}

function getWebpackConfig(modules) {
  const pkg = require(getProjectPath('package.json'));
  const babelConfig = require('./getBabelCommonConfig')(modules || false);
  babelConfig.sourceType = 'unambiguous';

  // babel import for components
  babelConfig.plugins.push(
    [
      resolve('babel-plugin-import'),
      {
        style: true,
        libraryName: pkg.name,
        libraryDirectory: 'components',
      },
      'c7n',
    ],
    [
      resolve('babel-plugin-import'),
      {
        style: true,
        libraryName: pkg.name + '/pro',
        libraryDirectory: 'components-pro',
      },
      'c7n-pro',
    ],
  );

  const config = {
    target: ['web', 'es5'],
    devtool: 'source-map',

    output: {
      path: getProjectPath('./dist/'),
      filename: '[name].js',
    },

    resolve: {
      modules: ['node_modules'],
      extensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
      ],
      alias: {
        [`${pkg.name}/dataset`]: getProjectPath('components-dataset'),
        [`${pkg.name}/shared`]: getProjectPath('components-shared'),
        [`${pkg.name}/pro/lib`]: getProjectPath('components-pro'),
        [`${pkg.name}/pro`]: getProjectPath('index-pro'),
        [`${pkg.name}/lib`]: getProjectPath('components'),
        [pkg.name]: process.cwd(),
      },
      fallback: {
        child_process: false,
        cluster: false,
        dgram: false,
        dns: false,
        fs: false,
        module: false,
        net: false,
        readline: false,
        repl: false,
        tls: false,
      },
    },

    module: {
      noParse: [/moment.js/],
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: resolve('babel-loader'),
          options: babelConfig,
        },
        {
          test: /\.m?js$/,
          include: /node_modules[/\\]tslib[/\\]/,
          loader: resolve('babel-loader'),
          options: babelConfig,
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: resolve('babel-loader'),
              options: babelConfig,
            },
            {
              loader: resolve('ts-loader'),
              options: {
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: postcssConfig,
                sourceMap: true,
              },
            },
          ],
        },
        {
          test: /\.less$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: postcssConfig,
                sourceMap: true,
              },
            },
            {
              loader: resolve('less-loader'),
              options: {
                // 所有 compiler 共用 Less render 队列，避免并发解析导致选择器缺失。
                implementation: lessImplementation,
                lessOptions: {
                  javascriptEnabled: true,
                },
                // 通过串行编译保留原始 Less 文件、行列映射，无需关闭 sourceMap 来规避缺类问题。
                sourceMap: true,
              },
            },
          ],
        },
        getAssetRule(/\.woff$/, 'application/font-woff'),
        getAssetRule(/\.woff2$/, 'application/font-woff'),
        getAssetRule(/\.ttf$/, 'application/octet-stream'),
        getAssetRule(/\.eot$/, 'application/vnd.ms-fontobject'),
        getAssetRule(/\.svg$/, svgOptions.mimetype),
        getAssetRule(/\.(png|jpg|jpeg|gif)$/i),
      ],
    },

    plugins: [
      new CaseSensitivePathsPlugin(),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new webpack.BannerPlugin(`
${pkg.name} v${pkg.version}
      `),
      new webpack.ProgressPlugin(),
    ],

    ignoreWarnings: [
      /mini-css-extract-plugin[^]*Conflicting order/,
      /export .* was not found in .*/,
    ],

    performance: {
      hints: false,
    },
  };

  if (process.env.RUN_ENV === 'PRODUCTION') {
    const entry = ['./index'];
    const entryPro = ['./index-pro'];
    const entryDemoDataMock = ['./site/theme/mock/browser-online-demo'];

    config.externals = {
      react: {
        root: 'React',
        commonjs2: 'react',
        commonjs: 'react',
        amd: 'react',
      },
      'react-dom': {
        root: 'ReactDOM',
        commonjs2: 'react-dom',
        commonjs: 'react-dom',
        amd: 'react-dom',
      },
      mobx: {
        root: 'mobx',
        commonjs2: 'mobx',
        commonjs: 'mobx',
        amd: 'mobx',
      },
    };
    config.output.library = {
      name: '[name]',
      type: 'umd',
    };
    config.output.globalObject = 'this';
    config.optimization = {
      minimizer: [
        new TerserJSPlugin({
          parallel: true,
          extractComments: true,
          terserOptions: { ecma: 5 },
        }),
        new CssMinimizerPlugin(),
      ],
    };

    const uncompressedConfig = webpackMerge(config, {
      entry: {
        [pkg.name]: entry,
        [`${pkg.name}-pro`]: entryPro,
        [`${pkg.name}-demo-data-mock`]: entryDemoDataMock,
      },
      mode: 'development',
    });

    const prodConfig = webpackMerge(config, {
      entry: {
        [`${pkg.name}.min`]: entry,
        [`${pkg.name}-pro.min`]: entryPro,
        [`${pkg.name}-demo-data-mock.min`]: entryDemoDataMock,
      },
      mode: 'production',
    });

    return [prodConfig, uncompressedConfig];
  }

  return config;
}

getWebpackConfig.webpack = webpack;
getWebpackConfig.svgRegex = svgRegex;
getWebpackConfig.svgOptions = svgOptions;
getWebpackConfig.imageOptions = imageOptions;

module.exports = getWebpackConfig;
