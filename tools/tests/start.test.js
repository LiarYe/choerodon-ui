const assert = require('assert');
const path = require('path');
const vm = require('vm');
const opensslEnv = require('../../site/legacy-build/opensslEnv');

const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'site/legacy-build/start.js');
const source = require('fs').readFileSync(filename, 'utf8');

function run(command, generatedResult = { status: 0 }, nodeVersion = '20.0.0', environment = { NODE_ENV: '', NODE_OPTIONS: '--trace-warnings' }) {
  const calls = [];
  const eventHandlers = {};
  const loggedErrors = [];
  const exitSignal = {};
  const state = { cwd: undefined, exitArgument: undefined, error: undefined };
  const env = Object.freeze({ ...environment });
  const child = {
    on(event, handler) {
      eventHandlers[event] = handler;
      return this;
    },
    kill(signal) {
      calls.push(['kill', signal]);
    },
  };
  const processMock = {
    argv: ['node', filename, command],
    env,
    execPath: process.execPath,
    versions: { node: nodeVersion },
    chdir(directory) {
      state.cwd = directory;
    },
    exit(code) {
      state.exitArgument = code;
      throw exitSignal;
    },
    on(event, handler) {
      eventHandlers[`process:${event}`] = handler;
    },
  };
  const legacy = {
    root,
    resolve(request) {
      assert.strictEqual(request, `bisheng/bin/bisheng-${command}`);
      return `bisheng-${command}`;
    },
    load(request) {
      assert.strictEqual(request, 'rimraf');
      return {
        sync(target) {
          calls.push(['rimraf', target]);
        },
      };
    },
  };
  const childProcess = {
    spawnSync(...args) {
      calls.push(['spawnSync', ...args]);
      return generatedResult;
    },
    spawn(...args) {
      calls.push(['spawn', ...args]);
      return child;
    },
  };
  const sandbox = {
    __dirname: path.dirname(filename),
    process: processMock,
    console: { error: error => loggedErrors.push(error) },
    require(name) {
      if (name === 'path') return path;
      if (name === 'child_process') return childProcess;
      if (name === './opensslEnv') return opensslEnv;
      assert.strictEqual(name, './resolve');
      return legacy;
    },
  };

  try {
    vm.runInNewContext(source, sandbox, { filename });
  } catch (error) {
    if (error !== exitSignal) state.error = error;
  }

  return { calls, env, eventHandlers, loggedErrors, process: processMock, state };
}

['start', 'build'].forEach((command) => {
  const success = run(command);
  assert.deepStrictEqual(success.calls.map(([name]) => name), ['rimraf', 'spawnSync', 'spawn']);
  assert.strictEqual(success.state.cwd, root);
  assert.strictEqual(success.calls[0][1], path.join(root, '_site'));
  assert.strictEqual(success.calls[1][1], process.execPath);
  assert.deepStrictEqual(Array.from(success.calls[1][2]), [
    path.join(root, 'scripts/generateColorLess.js'),
  ]);
  assert.strictEqual(success.calls[1][3].cwd, root);
  assert.strictEqual(success.calls[1][3].stdio, 'inherit');
  assert.strictEqual(success.calls[1][3].env.NODE_OPTIONS, '--trace-warnings --openssl-legacy-provider');
  assert.strictEqual(success.calls[1][3].env.NODE_ENV, command === 'start' ? 'development' : 'production');
  assert.strictEqual(success.calls[1][3].env.BISHENG_COMMAND, command);
  assert.strictEqual(success.env.NODE_ENV, '');
  assert.strictEqual(success.env.NODE_OPTIONS, '--trace-warnings');
  assert.strictEqual(success.calls[2][3].env, success.calls[1][3].env);
  assert.deepStrictEqual(success.calls[2][1], process.execPath);
  assert.deepStrictEqual(Array.from(success.calls[2][2]), [
    `bisheng-${command}`, '-c', './site/bisheng.config.js',
  ]);
  assert.strictEqual(success.state.error, undefined);

  const generationFailure = new Error(`${command} color generation failed`);
  const failedSpawn = run(command, { error: generationFailure });
  assert.strictEqual(failedSpawn.state.error, generationFailure);
  assert.deepStrictEqual(failedSpawn.calls.map(([name]) => name), ['rimraf', 'spawnSync']);

  const failedResult = run(command, { status: 7 });
  assert.strictEqual(failedResult.state.exitArgument, 7);
  assert.deepStrictEqual(failedResult.calls.map(([name]) => name), ['rimraf', 'spawnSync']);

  const interrupted = run(command, { status: null, signal: 'SIGTERM' });
  assert.strictEqual(interrupted.state.exitArgument, 1);
  assert.deepStrictEqual(interrupted.calls.map(([name]) => name), ['rimraf', 'spawnSync']);

  success.eventHandlers.exit(9);
  assert.strictEqual(success.process.exitCode, 9);
  success.eventHandlers.exit(null);
  assert.strictEqual(success.process.exitCode, 1);
  success.eventHandlers.exit(0);
  assert.strictEqual(success.process.exitCode, 0);
  const cliFailure = new Error(`${command} failed`);
  success.eventHandlers.error(cliFailure);
  assert.strictEqual(success.process.exitCode, 1);
  assert.deepStrictEqual(success.loggedErrors, [cliFailure]);
});

const originalEnvironment = { ...process.env };
Array.from({ length: 11 }, (_, index) => index + 14).forEach(major => {
  const nodeVersion = `${major}.0.0`;
  [
    {},
    { NODE_OPTIONS: '' },
    { NODE_OPTIONS: '--trace-warnings' },
    { NODE_OPTIONS: '--trace-warnings --openssl-legacy-provider' },
    { NODE_OPTIONS: '--openssl-legacy-provider --trace-warnings' },
  ].forEach(options => {
    const environment = Object.freeze({ NODE_ENV: 'custom', BISHENG_COMMAND: 'original', CUSTOM: 'preserved', ...options });
    const expectedOptions = major >= 17
      ? `${options.NODE_OPTIONS || ''}${(options.NODE_OPTIONS || '').includes('--openssl-legacy-provider') ? '' : ' --openssl-legacy-provider'}`.trim()
      : options.NODE_OPTIONS;
    const expected = { ...environment };
    if (major >= 17) expected.NODE_OPTIONS = expectedOptions;
    const result = opensslEnv(environment, nodeVersion);
    assert.notStrictEqual(result, environment);
    assert.deepStrictEqual(result, expected);
    assert.deepStrictEqual(opensslEnv(result, nodeVersion), expected);

    ['start', 'build'].forEach(command => {
      const success = run(command, { status: 0 }, nodeVersion, environment);
      assert.strictEqual(success.state.error, undefined);
      assert.deepStrictEqual(success.calls.map(([name]) => name), ['rimraf', 'spawnSync', 'spawn']);
      const childEnv = success.calls[1][3].env;
      assert.notStrictEqual(childEnv, success.env);
      assert.deepStrictEqual(childEnv, { ...expected, BISHENG_COMMAND: command });
      assert.strictEqual(success.calls[2][3].env, childEnv);
      assert.deepStrictEqual(success.env, environment);
    });
  });
});
assert(require('util').isDeepStrictEqual({ ...process.env }, originalEnvironment), 'Process environment must remain unchanged');

console.log('PASS color.less generation, error propagation and immutable OpenSSL environments for Node 14-24');
