const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'tools/utils/projectHelper.js');
const source = fs.readFileSync(filename, 'utf8');

function load(requireModule) {
  const calls = [];
  function Module() {}
  Module.prototype.require = function(...args) {
    calls.push({ receiver: this, args });
    return requireModule.apply(this, args);
  };
  const sandbox = {
    module: { exports: {} },
    process: { cwd: () => root },
    require(name) {
      if (name === 'fs') return fs;
      if (name === 'path') return path;
      assert.strictEqual(name, 'module');
      return Module;
    },
  };
  vm.runInNewContext(source, sandbox, { filename });
  sandbox.module.exports.injectRequire();
  const injected = Module.prototype.require;
  sandbox.module.exports.injectRequire();
  assert.strictEqual(Module.prototype.require, injected);
  return { instance: new Module(), calls };
}

function missing(name) {
  const error = new Error(`Cannot find module '${name}'`);
  error.code = 'MODULE_NOT_FOUND';
  return error;
}

const value = { answer: 42 };
const normal = load(() => value);
assert.strictEqual(normal.instance.require('available-module'), value);
assert.strictEqual(normal.calls.length, 1);
assert.strictEqual(normal.calls[0].receiver, normal.instance);
assert.deepStrictEqual(normal.calls[0].args, ['available-module']);

const fallbackPath = path.join(root, 'node_modules', 'missing-module');
const fallback = load(name => {
  if (name === 'missing-module') throw missing(name);
  assert.strictEqual(name, fallbackPath);
  return value;
});
assert.strictEqual(fallback.instance.require('missing-module', 'extra'), value);
assert.strictEqual(fallback.calls.length, 2);
assert.deepStrictEqual(fallback.calls.map(call => call.args), [
  ['missing-module', 'extra'], [fallbackPath, 'extra'],
]);
fallback.calls.forEach(call => assert.strictEqual(call.receiver, fallback.instance));

[
  { name: 'parent-module', error: missing('nested-dependency') },
  { name: 'parent-module', error: new TypeError('module initialization failed') },
  { name: './relative-module', error: missing('./relative-module') },
  { name: path.join(root, 'absolute-module'), error: missing(path.join(root, 'absolute-module')) },
].forEach(({ name, error }) => {
  const stack = error.stack;
  const result = load(() => { throw error; });
  assert.throws(() => result.instance.require(name), actual => actual === error);
  assert.strictEqual(error.stack, stack);
  assert.strictEqual(result.calls.length, 1);
  assert.deepStrictEqual(result.calls[0].args, [name]);
});

const fallbackError = new Error('fallback module initialization failed');
const failedFallback = load(name => {
  if (name === 'missing-module') throw missing(name);
  throw fallbackError;
});
assert.throws(() => failedFallback.instance.require('missing-module'), error => error === fallbackError);
assert.strictEqual(failedFallback.calls.length, 2);
console.log('PASS injectRequire normal loading, fallback, idempotency and original nested/runtime errors');
