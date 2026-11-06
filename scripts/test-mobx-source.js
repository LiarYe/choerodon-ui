const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const glob = require('glob');
const manifest = require('../tests/mobx-source-manifest.json');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'mobx-source-gate');
const components = [...manifest.legacy, ...manifest.added];
const dataset = glob.sync('components-dataset/**/*.test.js', { cwd: root }).sort();
assert.strictEqual(manifest.legacy.length, 38);
assert.strictEqual(new Set(components).size, components.length);
assert(dataset.length > 0, 'No source dataset tests found');
components.concat(dataset).forEach(file => {
  assert(fs.existsSync(path.join(root, file)), `Missing test: ${file}`);
});
manifest.cold.forEach(entry => assert(components.includes(entry.file), `Unlisted cold test: ${entry.file}`));
assert.strictEqual(manifest.cold.length, 2);
fs.mkdirSync(output, { recursive: true });

const stages = [
  { name: 'aliases', files: ['tests/mobx-source-alias.test.js'] },
  { name: 'dataset', files: dataset },
  { name: 'components', files: components },
  ...manifest.cold.map(entry => ({ ...entry, files: [entry.file] })),
];
const results = stages.map(stage => {
  const report = path.join(output, `${stage.name}.json`);
  const log = fs.openSync(path.join(output, `${stage.name}.log`), 'w');
  fs.writeFileSync(report, '{}\n');
  const args = [
    require.resolve('jest/bin/jest'), '--config', '.jest.mobx-source.js',
    '--runInBand', '--ci', '--cache=false', '--json', '--outputFile', report,
    '--runTestsByPath', ...stage.files,
  ];
  if (stage.testNamePattern) args.push('--testNamePattern', stage.testNamePattern);
  process.stdout.write(`Running ${stage.name}: ${stage.files.length} source suites\n`);
  let child;
  try {
    child = spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, LIB_DIR: 'components', NODE_ENV: 'test' },
      stdio: ['ignore', log, log],
    });
  } finally {
    fs.closeSync(log);
  }
  const data = JSON.parse(fs.readFileSync(report, 'utf8'));
  const executed = (data.testResults || []).map(test => path.relative(root, test.name).replace(/\\/g, '/')).sort();
  const complete = JSON.stringify(executed) === JSON.stringify(stage.files.slice().sort());
  const passed = child.status === 0 && data.success === true && complete
    && data.numPendingTestSuites === 0 && data.numTodoTests === 0
    && (stage.testNamePattern ? data.numPassedTests === 1 : data.numPendingTests === 0);
  const result = {
    name: stage.name, passed, exitCode: child.status, complete,
    suites: data.numTotalTestSuites, tests: data.numTotalTests,
    passedTests: data.numPassedTests, failedTests: data.numFailedTests,
    skippedTests: data.numPendingTests, error: child.error && child.error.message,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!passed) console.error(`See ${path.relative(root, output)}/${stage.name}.log`);
  return result;
});
fs.writeFileSync(path.join(output, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`);
process.exitCode = results.every(result => result.passed) ? 0 : 1;
