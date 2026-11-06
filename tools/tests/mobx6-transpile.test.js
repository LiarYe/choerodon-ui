const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const ts = require('typescript');
const mobx = require('mobx');
const babelConfig = require('../getBabelCommonConfig');
const tsConfig = require('../getTSCommonConfig');
const jestTransform = require('../jest/codePreprocessor');

const root = path.resolve(__dirname, '../..');
const options = ts.convertCompilerOptionsFromJson(tsConfig(), root).options;
const filename = path.join(root, 'components-dataset/data-set/AttachmentFileChunk.tsx');
const source = fs.readFileSync(filename, 'utf8');
const chains = {
  babel: () => babel.transformSync(source, { ...babelConfig(), filename }).code,
  typescriptBabel: () => babel.transformSync(ts.transpileModule(source, {
    compilerOptions: options,
    fileName: filename,
  }).outputText, { ...babelConfig(), filename: filename.replace(/\.tsx$/, '.js') }).code,
  jest: () => {
    const result = jestTransform.process(source, filename, { rootDir: root }, { instrument: false });
    return typeof result === 'string' ? result : result.code;
  },
};

Object.entries(chains).forEach(([name, compile]) => {
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compile(), filename);
  const Chunk = loaded.exports.default;
  const chunk = new Chunk({ percent: 15, start: 0, end: 100 });
  assert(mobx.isObservableProp(chunk, 'percent'), name);
  assert(mobx.isObservableProp(chunk, 'aborted'), name);
  const values = [];
  const dispose = mobx.autorun(() => values.push(chunk.percent));
  mobx.runInAction(() => { chunk.percent = 60; });
  dispose();
  assert.deepStrictEqual(values, [15, 60], name);
  process.stdout.write(`PASS ${name}: actual AttachmentFileChunk initialization and updates\n`);
});
