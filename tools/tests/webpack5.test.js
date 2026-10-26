const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');

if (process.env.WEBPACK5_NODE_MODULES) {
  const dependencies = new Set([
    'webpack', 'webpack-merge', 'mini-css-extract-plugin', 'css-minimizer-webpack-plugin',
    'terser-webpack-plugin', 'less-loader', 'postcss-loader', 'ts-loader', 'webpackbar', 'css-loader',
  ]);
  const originalResolve = Module._resolveFilename;
  const directory = path.resolve(process.env.WEBPACK5_NODE_MODULES);
  Module._resolveFilename = function resolveDependency(request, ...args) {
    const dependency = request.split('/')[0];
    const redirected = dependencies.has(dependency) ? path.join(directory, request) : request;
    return originalResolve.call(this, redirected, ...args);
  };
  console.log(`Isolated Webpack 5 dependencies: ${directory}`);
}

const webpack = require('webpack');
const acorn = require('acorn');
const postcss = require('postcss');
const { SourceMapConsumer } = require('source-map');
const less = require('less');
const originalRender = less.render;
const lessImplementation = require('../lessImplementation');
const transformLess = require('../transformLess');

const root = path.resolve(__dirname, '../..');
const packageName = require('../../package.json').name;

function loadConfig(environment) {
  const previous = process.env.RUN_ENV;
  if (environment) {
    process.env.RUN_ENV = environment;
  } else {
    delete process.env.RUN_ENV;
  }
  const filename = require.resolve('../../webpack.config');
  delete require.cache[filename];
  try {
    return require(filename);
  } finally {
    if (previous === undefined) {
      delete process.env.RUN_ENV;
    } else {
      process.env.RUN_ENV = previous;
    }
  }
}

function testDistLifecycle() {
  const source = fs.readFileSync(path.join(root, 'gulpfile.js'), 'utf8');
  const start = source.indexOf('function dist(done) {');
  const end = source.indexOf('\nfunction tag()', start);
  assert(start !== -1 && end !== -1);
  const fatal = new Error('fatal');
  const closeFailure = new Error('close');
  const cases = [
    { setup: fatal, error: fatal, closed: false },
    { cleanup: fatal, error: fatal, closed: true },
    { fatal, error: fatal, closed: true },
    { errors: true, error: 'Webpack dist compilation failed', closed: true },
    { close: closeFailure, error: closeFailure, closed: true },
    { error: undefined, closed: true },
    { environment: 'DEVELOPMENT', error: undefined, closed: true },
    { environment: 'DEVELOPMENT', setup: fatal, error: fatal, closed: false },
  ];
  cases.forEach(testCase => {
    let closed = false;
    const sandbox = {
      rimraf: { sync() { if (testCase.cleanup) throw testCase.cleanup; } },
      path,
      cwd: root,
      process: { env: testCase.environment ? { RUN_ENV: testCase.environment } : {} },
      require: Object.assign(() => [], { resolve: value => value, cache: {} }),
      console: { log() {}, warn() {}, error() {} },
      webpack() {
        if (testCase.setup) throw testCase.setup;
        return {
          run(callback) {
            callback(testCase.fatal, {
              toJson: () => ({ errors: [], warnings: [] }),
              hasErrors: () => Boolean(testCase.errors),
              hasWarnings: () => false,
              toString: () => '',
            });
          },
          close(callback) {
            closed = true;
            callback(testCase.close);
          },
        };
      },
    };
    vm.runInNewContext(source.slice(start, end), sandbox);
    let calls = 0;
    sandbox.dist(error => {
      calls += 1;
      assert.strictEqual(typeof testCase.error === 'string' ? error.message : error, testCase.error);
      assert.strictEqual(closed, testCase.closed);
      assert.strictEqual(sandbox.process.env.RUN_ENV, testCase.environment);
    });
    assert.strictEqual(calls, 1);
    assert.strictEqual(sandbox.process.env.RUN_ENV, testCase.environment);
  });
}

function compile(config) {
  const compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) {
          reject(error || closeError);
        } else if (stats.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
        } else {
          resolve(stats);
        }
      });
    });
  });
}

async function testLessQueue() {
  assert.notStrictEqual(lessImplementation, less);
  assert.strictEqual(less.render, originalRender);
  ['version', 'parse', 'tree', 'FileManager', 'functions', 'environment'].forEach(key => {
    assert.strictEqual(lessImplementation[key], less[key]);
  });
  const events = [];
  const failure = new Error('render failure');
  const fakeLess = {
    render(input) {
      events.push(`start:${input}`);
      if (input === 'throw') throw failure;
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          events.push(`end:${input}`);
          if (input === 'reject') reject(failure);
          else resolve({ css: input });
        }, 5);
      });
    },
  };
  const sandbox = { require: () => fakeLess, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'tools/lessImplementation.js'), 'utf8'), sandbox);
  const implementation = sandbox.module.exports;
  const results = await Promise.allSettled([
    implementation.render('first'),
    implementation.render('reject'),
    implementation.render('throw'),
    implementation.render('last'),
  ]);
  assert.deepStrictEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'rejected', 'fulfilled']);
  assert.strictEqual(results[1].reason, failure);
  assert.strictEqual(results[2].reason, failure);
  assert.deepStrictEqual(events, [
    'start:first', 'end:first', 'start:reject', 'end:reject', 'start:throw', 'start:last', 'end:last',
  ]);
  await new Promise((resolve, reject) => {
    assert.strictEqual(implementation.render('callback', {}, (error, output) => {
      if (error) reject(error);
      else {
        assert.strictEqual(output.css, 'callback');
        resolve();
      }
    }), undefined);
  });
  await new Promise(resolve => {
    implementation.render('reject', error => {
      assert.strictEqual(error, failure);
      resolve();
    });
  });
  assert.strictEqual((await implementation.render('recovered')).css, 'recovered');
  const realResults = await Promise.allSettled([
    lessImplementation.render('.broken { color: @undefined; }'),
    lessImplementation.render('.recovered { color: red; }'),
  ]);
  assert.strictEqual(realResults[0].status, 'rejected');
  assert(realResults[1].value.css.includes('color: red'));
  assert.strictEqual(less.render, originalRender);
  console.log('PASS shared Less API + serial queue + rejection/throw/callback recovery');
}

function testLessSourceMap(directory, name, theme) {
  const css = fs.readFileSync(path.join(directory, `${name}.css`), 'utf8');
  const map = JSON.parse(fs.readFileSync(path.join(directory, `${name}.css.map`), 'utf8'));
  assert.strictEqual(map.file, `${name}.css`);
  const consumer = new SourceMapConsumer(map);
  const declarations = [];
  postcss.parse(css).walkDecls(declaration => {
    if (declaration.prop !== 'color' && declaration.prop !== 'content') return;
    const position = consumer.originalPositionFor({
      line: declaration.source.start.line,
      column: declaration.source.start.column - 1,
    });
    const filename = `${theme ? 'variables' : 'defaultVars'}.less`;
    assert(position.source && position.source.replace(/\\/g, '/').endsWith(`/${filename}`), JSON.stringify(position));
    assert.strictEqual(position.line, declaration.prop === 'color' ? 2 : 3);
    assert.strictEqual(position.column, 2);
    assert.strictEqual(consumer.sourceContentFor(position.source), fs.readFileSync(path.join(path.dirname(directory), filename), 'utf8'));
    declarations.push(declaration.prop);
  });
  assert.deepStrictEqual(declarations.sort(), ['color', 'content']);
  if (consumer.destroy) consumer.destroy();
}

function testUmd(source, libraryName) {
  const modules = { react: {}, 'react-dom': {}, mobx: {}, moment: {} };
  const verify = value => {
    assert.strictEqual(value.answer, 42);
    assert.strictEqual(value.helpers.__assign({}, { answer: 42 }).answer, 42);
    assert.strictEqual(value.commonjs({}), 'object');
    assert.strictEqual(value.contract.react, modules.react);
    assert.strictEqual(value.contract.reactDom, modules['react-dom']);
    assert.strictEqual(value.contract.mobx, modules.mobx);
    assert.strictEqual(value.contract.moment, modules.moment);
    assert.strictEqual(value.contract.fs, value.contract.empty);
    assert(value.contract.small.startsWith('data:image/svg+xml;base64,'));
    assert(/large\.[a-f\d]{8}\.svg$/.test(value.contract.large));
  };
  const exports = {};
  const commonjs = { exports, module: { exports }, require: name => modules[name] };
  vm.runInNewContext(source, commonjs);
  verify(commonjs.module.exports);
  let amd;
  const define = (dependencies, factory) => {
    amd = factory(...dependencies.map(name => modules[name]));
  };
  define.amd = {};
  vm.runInNewContext(source, { define });
  verify(amd);
  const browser = { React: modules.react, ReactDOM: modules['react-dom'], mobx: modules.mobx, moment: modules.moment };
  vm.runInNewContext(source, browser);
  verify(browser[libraryName]);
}

async function main() {
  assert.strictEqual(webpack.version.split('.')[0], '5');
  testDistLifecycle();
  await testLessQueue();
  const development = loadConfig();
  assert(!Array.isArray(development));
  webpack.validate(development);
  assert.strictEqual(development.plugins.filter(plugin => plugin.constructor.name === 'MiniCssExtractPlugin').length, 1);
  const configs = loadConfig('PRODUCTION');
  assert.strictEqual(configs.length, 4);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'c7n-webpack5-contract-'));
  try {
    fs.writeFileSync(path.join(directory, 'entry.js'), [
      "require('./style.less');",
      "export const answer = require('./value.ts').answer;",
      "export { default as helpers } from 'tslib';",
      "export const commonjs = require('./commonjs.js');",
      'export const contract = {',
      "react: require('react'), reactDom: require('react-dom'),",
      "mobx: require('mobx'), moment: require('moment'),",
      "fs: typeof require('fs'), empty: 'object',",
      "small: require('./small.svg?v=1.2.3'), large: require('./large.svg') };",
    ].join('\n'));
    fs.writeFileSync(path.join(directory, 'value.ts'), 'export const answer: number = (() => 42)();');
    fs.writeFileSync(path.join(directory, 'commonjs.js'), 'module.exports = function(value) { return typeof value; };');
    fs.writeFileSync(path.join(directory, 'style.less'), '@import "bridge.less";');
    fs.writeFileSync(path.join(directory, 'bridge.less'), '@import "@{c7n-root-entry-name}.less";');
    ['defaultVars', 'variables'].forEach(theme => {
      fs.writeFileSync(path.join(directory, `${theme}.less`), [
        '.contract {',
        `  color: ${theme === 'variables' ? 'blue' : 'red'};`,
        '  content: @c7n-root-entry-name;',
        '}',
      ].join('\n'));
    });
    fs.writeFileSync(path.join(directory, 'transform.less'), '@c7n-root-entry-name: variables;\n@import "style.less";');
    fs.writeFileSync(path.join(directory, 'small.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fs.writeFileSync(path.join(directory, 'large.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${' '.repeat(10001)}</svg>`);
    development.mode = 'development';
    development.entry = { contract: path.join(directory, 'style.less') };
    development.output.path = path.join(directory, 'development');
    development.module.rules.forEach(rule => {
      if (rule.use) {
        rule.use.forEach(loader => {
          if (typeof loader === 'object') loader.loader = require.resolve(loader.loader);
        });
      }
    });
    const developmentLess = development.module.rules.find(rule => rule.test.test('.less')).use.slice(-1)[0];
    assert.strictEqual(developmentLess.options.implementation, lessImplementation);
    assert.strictEqual(developmentLess.options.sourceMap, true);
    const [, transformed] = await Promise.all([
      compile(development),
      transformLess(path.join(directory, 'transform.less')),
    ]);
    assert(transformed.includes('color: blue'));
    assert(transformed.includes('content: variables'));
    testLessSourceMap(development.output.path, 'contract', false);
    assert(fs.readFileSync(path.join(development.output.path, 'contract.css'), 'utf8').includes('defaultVars'));
    console.log('PASS non-production CSS extraction');
    for (const [index, config] of configs.entries()) {
      webpack.validate(config);
      assert.deepStrictEqual(config.target, ['web', 'es5']);
      assert.deepStrictEqual(Object.keys(config.externals).sort(), ['mobx', 'moment', 'react', 'react-dom']);
      assert.strictEqual(config.devtool, 'source-map');
      const theme = index >= 2;
      const lessRule = config.module.rules.find(rule => rule.test.test('.less'));
      const lessOptions = lessRule.use[lessRule.use.length - 1].options.lessOptions;
      assert.strictEqual(lessRule.use[lessRule.use.length - 1].options.sourceMap, true);
      assert.strictEqual(lessRule.use[lessRule.use.length - 1].options.implementation, lessImplementation);
      assert.strictEqual(lessOptions.modifyVars['c7n-root-entry-name'], theme ? 'variables' : 'defaultVars');
      assert.strictEqual(config.optimization.minimizer.length, 2);
      const entries = Object.keys(config.entry);
      assert.strictEqual(entries.length, theme ? 2 : 5);
      entries.forEach(name => {
        const entry = config.entry[name];
        if (name.includes('-with-locales')) {
          assert.strictEqual(entry.library.name, name.includes('-pro-') ? `${packageName}/pro` : packageName);
        }
        config.entry[name] = Array.isArray(entry)
          ? [path.join(directory, 'entry.js')]
          : { ...entry, import: path.join(directory, 'entry.js') };
      });
      config.output.path = path.join(directory, `dist-${index}`);
      config.output.publicPath = '';
      config.resolve.modules.push(path.join(root, 'node_modules'));
      config.module.rules.forEach(rule => {
        if (rule.use) {
          rule.use.forEach(loader => {
            if (typeof loader === 'object') {
              loader.loader = require.resolve(loader.loader);
              if (loader.loader.includes('ts-loader')) {
                loader.options.configFile = path.join(root, 'tsconfig.json');
                loader.options.compiler = require.resolve('typescript');
                loader.options.compilerOptions = { rootDir: directory };
              }
            }
          });
        }
      });
      config.optimization.minimizer.forEach(plugin => { plugin.options.parallel = false; });
      await compile(config);
      const files = fs.readdirSync(config.output.path);
      entries.forEach(name => {
        assert(files.includes(`${name}.css`));
        assert(files.includes(`${name}.css.map`));
        testLessSourceMap(config.output.path, name, theme);
        assert(fs.readFileSync(path.join(config.output.path, `${name}.css`), 'utf8').includes(theme ? 'variables' : 'defaultVars'));
        if (theme) {
          assert(!files.some(file => file.startsWith(`${name}.js`)));
        } else {
          assert(files.includes(`${name}.js.map`));
          const source = fs.readFileSync(path.join(config.output.path, `${name}.js`), 'utf8');
          acorn.parse(source, { ecmaVersion: 5 });
          const libraryName = name.includes('-with-locales')
            ? (name.includes('-pro-') ? `${packageName}/pro` : packageName)
            : name;
          testUmd(source, libraryName);
        }
      });
      assert(files.some(file => /^large\.[a-f\d]{8}\.svg$/.test(file)));
      console.log(`PASS config ${index}: ${config.mode}, ${theme ? 'CSS-only theme' : 'UMD/CommonJS/AMD/global + externals + ES5'}, assets + source maps`);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log('PASS schema + Gulp setup/cleanup/fatal/compilation/close errors + environment restoration');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
