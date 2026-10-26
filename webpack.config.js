// This config is for building dist files
const getWebpackConfig = require('./tools/getWebpackConfig');
const pkg = require('./package.json');

const { webpack } = getWebpackConfig;

function injectLessVariables(config, variables) {
  (Array.isArray(config) ? config : [config]).forEach(conf => {
    conf.module.rules.forEach(rule => {
      // filter less rule
      if (rule.test instanceof RegExp && rule.test.test('.less')) {
        const lessRule = rule.use[rule.use.length - 1];
        if (lessRule.options.lessOptions) {
          lessRule.options.lessOptions.modifyVars = {
            ...lessRule.options.lessOptions.modifyVars,
            ...variables,
          };
        } else {
          lessRule.options.modifyVars = {
            ...lessRule.options.modifyVars,
            ...variables,
          };
        }
      }
    });
  });

  return config;
}

// noParse still leave `require('./locale' + name)` in dist files
// ignore is better
// http://stackoverflow.com/q/25384360
function ignoreMomentLocale(webpackConfig) {
  delete webpackConfig.module.noParse;
  webpackConfig.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  );
}

function addLocales(webpackConfig) {
  let packageName = `${pkg.name}-with-locales`;
  let packageNamePro = `${pkg.name}-pro-with-locales`;
  if (webpackConfig.entry[`${pkg.name}.min`]) {
    packageName += '.min';
  }
  if (webpackConfig.entry[`${pkg.name}-pro.min`]) {
    packageNamePro += '.min';
  }
  webpackConfig.entry[packageName] = {
    import: './index-with-locales.js',
    library: { name: pkg.name, type: 'umd' },
  };
  webpackConfig.entry[packageNamePro] = {
    import: './index-pro-with-locales.js',
    library: { name: `${pkg.name}/pro`, type: 'umd' },
  };
  webpackConfig.output.filename = '[name].js';
}

function externalMoment(config) {
  config.externals.moment = {
    root: 'moment',
    commonjs2: 'moment',
    commonjs: 'moment',
    amd: 'moment',
  };
}

function processWebpackThemeConfig(themeConfig, theme, vars) {
  themeConfig.forEach(config => {
    ignoreMomentLocale(config);
    externalMoment(config);

    // rename default entry to ${theme} entry
    Object.keys(config.entry).forEach(entryName => {
      const originPath = config.entry[entryName];
      // We will replace `./index` to `./index-style-only`
      // and `./index-pro` to `./index-pro-style-only` since theme dist only use style file
      if (originPath.length === 1 && originPath[0] === './index') {
        config.entry[entryName.replace(pkg.name, `${pkg.name}.${theme}`)] = ['./index-style-only'];
      } else if (originPath.length === 1 && originPath[0] === './index-pro') {
        config.entry[entryName.replace(`${pkg.name}-pro`, `${pkg.name}-pro.${theme}`)] = ['./index-pro-style-only'];
      }

      delete config.entry[entryName];
    });

    // apply ${theme} less variables
    injectLessVariables(config, vars);

    // ignore emit ${theme} entry js & js.map file
    config.plugins.push(
      {
        apply(compiler) {
          compiler.hooks.thisCompilation.tap('RemoveThemeScripts', compilation => {
            compilation.hooks.processAssets.tap(
              {
                name: 'RemoveThemeScripts',
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
              },
              () => {
                Object.keys(config.entry).forEach(entryName => {
                  ['.js', '.js.map', '.js.LICENSE.txt'].forEach(extension => {
                    compilation.deleteAsset(`${entryName}${extension}`);
                  });
                });
              },
            );
          });
        },
      },
    );
  });
}

const webpackConfig = injectLessVariables(getWebpackConfig(false), {
  'c7n-root-entry-name': 'defaultVars',
});
if (process.env.RUN_ENV === 'PRODUCTION') {
  const webpackVariableConfig = injectLessVariables(getWebpackConfig(false), {
    'c7n-root-entry-name': 'variables',
  });
  webpackConfig.forEach(config => {
    ignoreMomentLocale(config);
    externalMoment(config);
    addLocales(config);
  });

  processWebpackThemeConfig(webpackVariableConfig, 'variables', {});
  module.exports = [...webpackConfig, ...webpackVariableConfig];
} else {
  module.exports = webpackConfig;
}
