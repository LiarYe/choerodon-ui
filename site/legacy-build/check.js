const assert = require('assert');
const path = require('path');
const legacy = require('./resolve');
const manifest = require('./package.json');
const targets = require('./babelTargets');
const replaceLib = require('../../tools/replaceLib');

process.chdir(legacy.root);

Object.keys(manifest.dependencies).filter(name => name !== 'choerodon-ui').forEach(name => {
  legacy.resolve(`${name}/package.json`);
});
assert.throws(() => legacy.resolve('mobx/package.json'), /Legacy site dependency/);
assert.strictEqual(legacy.load('webpack/package.json').version.split('.')[0], '4');

const getConfig = legacy.load('bisheng/lib/utils/get-bisheng-config');
const getTheme = legacy.load('bisheng/lib/utils/get-theme-config');
const config = getConfig(path.join(legacy.root, 'site/bisheng.config.js'));
const theme = getTheme(config.theme);
const resolvePlugins = legacy.load('bisheng/lib/utils/resolve-plugins');

['node', 'browser'].forEach(target => {
  const plugins = resolvePlugins(theme.plugins, target);
  assert(plugins.length >= 3);
  plugins.forEach(([filename]) => assert(filename.replace(/\\+/g, '/').includes('/site/legacy-build/node_modules/')));
});

const demoPlugin = theme.plugins.find(plugin => plugin.includes('bisheng-plugin-choerodon-ui?'));
const demoConfig = JSON.parse(decodeURIComponent(demoPlugin.split('babelConfig=')[1]));
const acorn = require(require.resolve('acorn', { paths: [legacy.packageDirectory('webpack')] }));
const transformed = legacy.load('bisheng-plugin-react/lib/transformer')(
  'const Demo = () => <div>{data?.items?.[0] ?? "fallback"}</div>; ReactDOM.render(<Demo />, mountNode);',
  demoConfig,
);
assert(transformed.includes('React.createElement(Demo'));
acorn.parse(transformed, { ecmaVersion: 2019, sourceType: 'module' });

legacy.load('bisheng/lib/context').initialize({ bishengConfig: config, themeConfig: theme });
const common = legacy.load('bisheng/lib/config/getWebpackCommonConfig').default();
const webpackConfig = legacy.load('bisheng/lib/config/updateWebpackConfig').default(common, 'start');

assert.strictEqual(webpackConfig.context, legacy.root);
assert.deepStrictEqual(webpackConfig.resolveLoader.modules, [legacy.nodeModules]);
assert.strictEqual(webpackConfig.resolveLoader.alias.babel, legacy.resolve('babel-loader'));
assert.strictEqual(webpackConfig.resolve.alias.webpack, legacy.packageDirectory('webpack'));
['react', 'react-dom', 'mobx', 'mobx-react'].forEach(name => {
  assert.strictEqual(webpackConfig.resolve.alias[name], path.join(legacy.root, 'node_modules', name));
});

function checkRules(rules) {
  rules.forEach(rule => {
    if (rule.loader === legacy.resolve('babel-loader')) {
      assert(rule.options.plugins.includes(replaceLib));
      const preset = rule.options.presets.find(item => Array.isArray(item) && item[0] === legacy.resolve('@babel/preset-env'));
      assert.deepStrictEqual(preset[1].targets, targets);
      const { cacheDirectory, ...options } = rule.options;
      const output = legacy.load('@babel/core').transformSync(
        'const value = data?.items?.[0] ?? "fallback";',
        { ...options, babelrc: false, configFile: false },
      ).code;
      acorn.parse(output, { ecmaVersion: 2019, sourceType: 'module' });
    }
    if (Array.isArray(rule.use)) {
      checkRules(rule.use);
    }
    if (rule.oneOf) {
      checkRules(rule.oneOf);
    }
    if (rule.rules) {
      checkRules(rule.rules);
    }
  });
}

checkRules(webpackConfig.module.rules);
assert.deepStrictEqual(legacy.load('webpack').validate(webpackConfig), []);
const compiler = legacy.load('webpack')(webpackConfig);
const clientDirectory = path.dirname(legacy.resolve('webpack-dev-server/client/index.js'));
const requests = [
  ['normal', clientDirectory, 'webpack/hot/emitter', legacy.resolve('webpack/hot/emitter')],
  ['normal', legacy.root, legacy.resolve('webpack/hot/dev-server.js'), legacy.resolve('webpack/hot/dev-server.js')],
  ['normal', legacy.root, legacy.resolve('webpack-dev-server/client/index.js'), legacy.resolve('webpack-dev-server/client/index.js')],
  ['normal', clientDirectory, 'url', legacy.resolve('url/url.js')],
  ['loader', legacy.root, 'babel', legacy.resolve('babel-loader')],
];
Promise.all(requests.map(([type, directory, request, expected]) => new Promise((resolve, reject) => {
  compiler.resolverFactory.get(type).resolve({}, directory, request, {}, (error, filename) => {
    if (error) return reject(error);
    try {
      assert.strictEqual(filename, expected);
      resolve();
    } catch (failure) {
      reject(failure);
    }
    return undefined;
  });
}))).then(() => {
  process.stdout.write('Legacy site dependency, plugin, Babel, webpack and HMR resolution checks passed.\n');
}).catch(error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
