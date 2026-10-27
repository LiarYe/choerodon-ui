const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const babel = require('@babel/core');
const postcss = require('postcss');

const root = path.resolve(__dirname, '../..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'c7n-gulp-contract-'));
const outputs = ['lib', 'es', 'pro/lib', 'pro/es', 'dataset', 'shared'];

function write(file, content) {
  const filename = path.join(directory, file);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

function read(file) {
  const filename = path.join(directory, file);
  assert(fs.existsSync(filename), `Missing ${file}`);
  assert(fs.statSync(filename).size > 0, `Empty ${file}`);
  return fs.readFileSync(filename, 'utf8');
}

function run(task, args = [], success = true) {
  const script = [
    `process.chdir(${JSON.stringify(directory)});`,
    `require(${JSON.stringify(path.join(root, 'gulpfile.js'))});`,
    `const gulp = require(${JSON.stringify(require.resolve('gulp'))});`,
    'gulp.on("error", () => {});',
    `gulp.series(${JSON.stringify(task)})(error => {`,
    'if (error) { console.error(error); console.log("COMPILE_FAILED"); process.exitCode = 1; } else console.log("COMPILE_COMPLETE");',
    '});',
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', script, '--', 'gulp-contract', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null, result.stderr);
  if (success) {
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert(result.stdout.includes('COMPILE_COMPLETE'), `${task}: task did not complete\n${result.stdout}${result.stderr}`);
  } else {
    assert.notStrictEqual(result.status, 0, 'Compilation unexpectedly succeeded');
    assert(result.stdout.includes('COMPILE_FAILED'), `${task}: failure callback not invoked\n${result.stdout}${result.stderr}`);
  }
  return result.stdout + result.stderr;
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex');
}

function checkScript(file, esm) {
  const source = read(file);
  const ast = babel.parseSync(source, {
    babelrc: false,
    configFile: false,
    sourceType: esm ? 'module' : 'script',
    filename: file,
  });
  if (esm) assert(ast.program.body.some(node => node.type.startsWith('Export')), file);
  else assert(source.includes('exports'), file);
  const map = JSON.parse(read(`${file}.map`));
  assert.strictEqual(map.version, 3, file);
  assert.strictEqual(map.file, path.basename(file), file);
  assert(map.sources.length > 0, file);
  assert(map.mappings.length > 0, file);
  assert(source.includes(`sourceMappingURL=${path.basename(file)}.map`), file);
}

function checkOutputs() {
  outputs.forEach(output => {
    checkScript(`${output}/index.js`, output === 'es' || output === 'pro/es');
    assert(read(`${output}/index.d.ts`).includes('answer'), output);
    assert(!fs.existsSync(path.join(directory, output, 'stale.js')), output);
  });
  ['lib', 'es', 'pro/lib', 'pro/es'].forEach(output => {
    const source = output.startsWith('pro/') ? 'components-pro' : 'components';
    ['image.png', 'image.svg'].forEach(file => {
      assert.strictEqual(hash(`${output}/assets/${file}`), hash(`${source}/assets/${file}`), `${output}/${file}: SHA-256`);
    });
    ['index', 'v2-compatible-reset'].forEach(name => {
      assert(read(`${output}/style/${name}.less`).includes('.contract'), output);
      const css = read(`${output}/style/${name}.css`);
      postcss.parse(css);
      assert(css.includes('.contract') && css.includes('color: red'), output);
    });
    const style = read(`${output}/style/index.js`);
    const css = read(`${output}/style/css.js`);
    assert(style.includes('./index.less'), output);
    assert(css.includes('./index.css') && !css.includes('.less'), output);
    ['index.js', 'css.js'].forEach(file => {
      assert.strictEqual(JSON.parse(read(`${output}/style/${file}.map`)).version, 3);
    });
  });
  ['lib', 'es'].forEach(output => {
    checkScript(`${output}/rc-components/contract/index.js`, output === 'es');
  });
  assert.strictEqual(read('dataset/axios/_helpers/contract.js'), read('components-dataset/axios/_helpers/contract.js'));
}

function checkPackageEntries() {
  ['main', 'module', 'main-pro', 'module-pro'].forEach(entry => {
    const filename = path.join(directory, JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))[entry]);
    assert(fs.existsSync(filename), `Missing package entry ${entry}`);
    assert(fs.statSync(filename).size > 0, `Empty package entry ${entry}`);
  });
}

async function streamRegression(projectRoot) {
  const vm = require('vm');
  const { PassThrough } = require('stream');
  const check = require('assert');
  const sourceCode = require('fs').readFileSync(require('path').join(projectRoot, 'gulpfile.js'), 'utf8');
  const createStream = () => new PassThrough({ objectMode: true });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  let input;
  let typescript;
  let reporter;
  const context = {
    merge2: require('merge2'),
    through2: require('through2'),
    argv: {},
    tsConfig: {},
    tsDefaultReporter: { error() {}, finish() {} },
    gulp: { src: () => input },
    babelify: stream => stream,
    ts(config, currentReporter) {
      reporter = currentReporter;
      typescript = createStream();
      typescript.js = createStream();
      typescript.dts = createStream();
      return typescript;
    },
  };
  vm.runInNewContext(sourceCode.slice(sourceCode.indexOf('function pipeStreams('), sourceCode.indexOf('function babelify(')), context);
  for (const stage of [0, 1, 2]) {
    for (const failure of ['error', 'close']) {
      const streams = [createStream(), createStream(), createStream()];
      const results = [];
      context.runCompile(context.pipeStreams(...streams.slice(0, 2)), streams[2], error => results.push(error));
      const expected = new Error('regression failure');
      streams[stage].destroy(failure === 'error' ? expected : undefined);
      await tick();
      await tick();
      check.strictEqual(results.length, 1, `${stage}/${failure}: callback count`);
      check(results[0], `${stage}/${failure}: failure missing`);
      if (failure === 'error') check.strictEqual(results[0], expected);
      check(streams.every(stream => stream.destroyed), `${stage}/${failure}: live stream`);
    }
  }
  const successSource = createStream();
  const successDestination = createStream();
  const successResults = [];
  context.runCompile(successSource, successDestination, error => successResults.push(error));
  for (let index = 0; index < 100; index += 1) successSource.write({ index });
  successSource.end();
  await tick();
  check.deepStrictEqual(successResults, [undefined]);
  for (const failure of ['typescript', 'source', 'js', 'dts', 'asset', 'close', 'typescript-close', 'cancel']) {
    input = createStream();
    const asset = createStream();
    const output = context.compileTypescript([], undefined, [asset]);
    const results = [];
    const destination = createStream();
    context.runCompile(output, destination, error => results.push(error));
    const expected = new Error('compile regression failure');
    if (failure === 'close') asset.destroy();
    else if (failure === 'typescript-close') typescript.destroy();
    else if (failure === 'cancel') output.destroy();
    else {
      const failing = { typescript, source: input, js: typescript.js, dts: typescript.dts, asset }[failure];
      failing.destroy(expected);
    }
    await tick();
    await tick();
    check.strictEqual(results.length, 1, `${failure}: callback count`);
    check(results[0], `${failure}: failure missing`);
    if (!['close', 'typescript-close', 'cancel'].includes(failure)) check.strictEqual(results[0], expected);
    check([input, typescript, typescript.js, typescript.dts, asset, output, destination].every(stream => stream.destroyed), `${failure}: live stream`);
  }
  context.argv['ignore-error'] = true;
  input = createStream();
  const ignored = context.compileTypescript([]);
  const ignoredResults = [];
  context.runCompile(ignored, createStream(), error => ignoredResults.push(error));
  reporter.error(new Error('diagnostic'));
  typescript.emit('error', new Error('TypeScript: Compilation failed'));
  check.strictEqual(ignored.destroyed, false);
  input.end();
  typescript.js.end();
  typescript.dts.end();
  await tick();
  await tick();
  check.deepStrictEqual(ignoredResults, [undefined]);
  console.log('PASS stream premature close, failure cancellation, callback once, destination drain and ignore-error');
}

try {
  const regression = spawnSync(process.execPath, ['-e', `(${streamRegression.toString()})(${JSON.stringify(root)}).catch(error => { console.error(error); process.exitCode = 1; });`], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(regression.error);
  assert.strictEqual(regression.status, 0, regression.stdout + regression.stderr);
  assert(regression.stdout.includes('PASS stream'), regression.stdout + regression.stderr);
  process.stdout.write(regression.stdout);
  const gulpManifest = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('gulp')), 'package.json'), 'utf8'));
  assert.strictEqual(gulpManifest.version.split('.')[0], '5');
  write('package.json', JSON.stringify({
    name: 'choerodon-ui',
    browserslist: ['last 2 Chrome versions'],
    main: 'lib/index.js',
    module: 'es/index.js',
    'main-pro': 'pro/lib/index.js',
    'module-pro': 'pro/es/index.js',
  }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: {
    target: 'esnext', module: 'esnext', declaration: true, types: [], skipLibCheck: true,
  } }));
  ['components', 'components-pro', 'components-dataset', 'components-shared'].forEach(source => {
    write(`${source}/index.tsx`, 'export const answer: number = 42;');
  });
  ['components', 'components-pro'].forEach(source => {
    write(`${source}/style/index.ts`, "import './index.less';");
    ['index', 'v2-compatible-reset'].forEach(name => {
      write(`${source}/style/${name}.less`, '.contract { color: red; }');
    });
    write(`${source}/assets/image.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64'));
    write(`${source}/assets/image.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><text>资源</text></svg>');
  });
  write('components/rc-components/contract/index.js', 'export const answer = 42;');
  write('components-dataset/axios/_helpers/contract.js', 'module.exports = 42;');
  for (let iteration = 0; iteration < 2; iteration += 1) {
    outputs.forEach(output => write(`${output}/stale.js`, 'stale'));
    run('compile');
    checkOutputs();
    checkPackageEntries();
    console.log(`PASS Gulp compile ${iteration + 1}: SHA-256 assets, CJS/ESM, declarations, maps, styles, rc and cleanup`);
  }
  fs.renameSync(path.join(directory, 'components/index.tsx'), path.join(directory, 'components/entry.tsx'));
  const missingEntries = run('compile', [], false);
  assert(missingEntries.includes('Missing or empty compile entries: lib/index.js, es/index.js'), missingEntries);
  fs.renameSync(path.join(directory, 'components/entry.tsx'), path.join(directory, 'components/index.tsx'));
  write('components-shared/index.tsx', 'export const answer: number = "invalid";');
  assert(run('compile-with-shared', [], false).includes('TS2322'));
  run('compile-with-shared', ['--ignore-error']);
  checkScript('shared/index.js', false);
  write('components/style/index.less', '.contract { color: @missing; }');
  assert(run('compile-with-lib', ['--ignore-error'], false).includes('@missing'));
  console.log('PASS Gulp type errors fail, ignore-error preserves emit, Less errors fail without hanging');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
