const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const legacy = require('../../site/legacy-build/resolve');
const targets = require('../../site/legacy-build/babelTargets');
const BuildErrorPlugin = require('../../site/legacy-build/BuildErrorPlugin');
const opensslEnv = require('../../site/legacy-build/opensslEnv');

process.chdir(legacy.root);

const theme = require('../../site/theme');
const transformer = legacy.load('bisheng-plugin-react/lib/transformer');
const acorn = require(require.resolve('acorn', { paths: [legacy.packageDirectory('webpack')] }));
const examples = [
  'components-pro/attachment/demo/temp-remove.md',
  'components-pro/table/demo/advanced-bar.md',
  'components-pro/table/demo/customized.md',
  'components-pro/table/demo/dyfilter-bar.md',
  'components-pro/table/demo/clipboard-paste.md',
  'components/tabs/demo/draggable-tabs.md',
];
theme.plugins.filter(plugin => plugin.includes('babelConfig=')).forEach(plugin => {
  const config = JSON.parse(decodeURIComponent(plugin.split('babelConfig=')[1]));
  assert.deepStrictEqual(config.presets[1][1].targets, targets);
  const snippets = examples.map(filename => {
    const markdown = fs.readFileSync(path.join(legacy.root, filename), 'utf8');
    return markdown.match(/```(?:jsx?|tsx?)\s*\r?\n([\s\S]*?)```/)[1];
  });
  snippets.push('const value = data?.items?.[0] ?? "fallback"; ReactDOM.render(<div>{value}</div>, mountNode);');
  snippets.forEach(source => {
    const output = transformer(source, config);
    acorn.parse(output, { ecmaVersion: 2019, sourceType: 'module' });
  });
});

[
  ['production', 'build'],
  ['development', 'start'],
  ['development', 'build'],
  ['production', 'start'],
].forEach(([environment, command]) => {
  process.env.NODE_ENV = environment;
  process.env.BISHENG_COMMAND = command;
  const filename = require.resolve('../../site/bisheng.config');
  delete require.cache[filename];
  const config = require(filename).webpackConfig({
    resolve: { modules: [], alias: {} },
    resolveLoader: {},
    module: { rules: [{
      loader: legacy.resolve('babel-loader'),
      options: legacy.load('bisheng/lib/config/getBabelCommonConfig').default(),
    }] },
    plugins: [],
  });
  assert.strictEqual(config.plugins.some(plugin => plugin instanceof BuildErrorPlugin), command === 'build');
  config.module.rules.forEach(rule => {
    const preset = rule.options.presets.find(item => Array.isArray(item) && item[0] === legacy.resolve('@babel/preset-env'));
    assert.deepStrictEqual(preset[1].targets, targets);
    const { cacheDirectory, ...options } = rule.options;
    const output = legacy.load('@babel/core').transformSync(
      'const value = data?.items?.[0] ?? "fallback";',
      { ...options, babelrc: false, configFile: false },
    ).code;
    acorn.parse(output, { ecmaVersion: 2019, sourceType: 'module' });
  });
});

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'c7n-site-test-'));
try {
  ['success', 'warning', 'compilation-error', 'fatal-error'].forEach(scenario => {
    const script = `
      const legacy = require('./site/legacy-build/resolve');
      const BuildErrorPlugin = require('./site/legacy-build/BuildErrorPlugin');
      const scenario = ${JSON.stringify(scenario)};
      const plugin = {
        apply(compiler) {
          if (scenario === 'fatal-error') compiler.hooks.beforeRun.tapAsync('Failure', (compiler, callback) => callback(new Error('fatal fixture')));
          if (scenario === 'warning') compiler.hooks.emit.tap('Warning', compilation => compilation.warnings.push(new Error('warning fixture')));
        }
      };
      legacy.load('webpack')({
        mode: 'development',
        entry: scenario === 'compilation-error' ? './missing-site-test-entry' : './site/legacy-build/babelTargets.js',
        output: { path: ${JSON.stringify(directory)}, filename: 'bundle.js' },
        plugins: [new BuildErrorPlugin(), plugin]
      }, () => {});
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: legacy.root,
      env: opensslEnv(),
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.ifError(result.error);
    assert.strictEqual(result.status, scenario.endsWith('error') ? 1 : 0, result.stderr);
    if (scenario === 'compilation-error') assert(result.stderr.includes('missing-site-test-entry'));
    if (scenario === 'fatal-error') assert(result.stderr.includes('fatal fixture'));
  });
} finally {
  legacy.load('rimraf').sync(directory);
}

console.log('PASS site demo targets, webpack 4 parsing, build failure exits and start isolation in both environments');
