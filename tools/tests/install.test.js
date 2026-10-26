const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'site/legacy-build/install.js');
const source = fs.readFileSync(filename, 'utf8');
const manifest = require('../../package.json');

function run(env, result = { status: 0 }) {
  const calls = [];
  const output = [];
  const sandbox = {
    __dirname: path.dirname(filename),
    process: { execPath: process.execPath, env, stdout: { write: value => output.push(value) } },
    require(name) {
      if (name === 'path') return path;
      assert.strictEqual(name, 'child_process');
      return { spawnSync(...args) { calls.push(args); return result; } };
    },
  };
  vm.runInNewContext(source, sandbox, { filename });
  return { calls, output, process: sandbox.process };
}

const env = { npm_execpath: 'npm-cli.js', KEEP_ME: 'preserved' };
const success = run(env);
assert.strictEqual(success.calls.length, 1);
const [executable, args, options] = success.calls[0];
assert.strictEqual(executable, process.execPath);
assert.deepStrictEqual(Array.from(args), [
  env.npm_execpath, 'ci', '--prefix', path.dirname(filename),
  '--legacy-peer-deps', '--no-audit', '--no-fund',
]);
assert.strictEqual(options.cwd, root);
assert.strictEqual(options.env.C7N_LEGACY_INSTALL_ACTIVE, '1');
assert.strictEqual(options.env.KEEP_ME, 'preserved');
assert.strictEqual(env.C7N_LEGACY_INSTALL_ACTIVE, undefined);
assert.strictEqual(success.process.exitCode, 0);
assert.strictEqual(run(env, { status: 7 }).process.exitCode, 7);
assert.strictEqual(run(env, { status: null, signal: 'SIGTERM' }).process.exitCode, 1);
const failure = new Error('spawn failed');
assert.throws(() => run(env, { error: failure }), error => error === failure);
assert.throws(() => run({}), /npm run install:legacy/);
const recursive = run({ C7N_LEGACY_INSTALL_ACTIVE: '1' });
assert.strictEqual(recursive.calls.length, 0);
assert(recursive.output.join('').includes('avoiding recursive installation'));

const command = manifest.scripts.postinstall.match(/^node -e "(.*)"$/)[1];
[false, true].forEach(exists => {
  let calls = 0;
  vm.runInNewContext(command, {
    require(name) {
      if (name === 'fs') return { existsSync: () => exists };
      assert.strictEqual(name, './site/legacy-build/install.js');
      calls += 1;
    },
  });
  assert.strictEqual(calls, exists ? 1 : 0);
});
const published = spawnSync(process.execPath, ['-e', command], { cwd: os.tmpdir(), encoding: 'utf8' });
assert.strictEqual(published.status, 0, published.stderr);
console.log('PASS installation recursion guard, npm arguments, inherited environment, failure propagation and published postinstall');
