const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '../..');
const nodeModules = path.join(__dirname, 'node_modules');
const localRequire = createRequire(path.join(__dirname, 'package.json'));

function resolve(request) {
  let filename;
  try {
    filename = localRequire.resolve(request);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    throw new Error(`Legacy site dependency ${request} is missing. Run npm install --prefix site/legacy-build --legacy-peer-deps from ${root}`);
  }
  const relative = path.relative(nodeModules, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Legacy site dependency ${request} is missing. Run npm install --prefix site/legacy-build --legacy-peer-deps from ${root}`);
  }
  return filename;
}

function load(request) {
  return localRequire(resolve(request));
}

function packageDirectory(name) {
  return path.dirname(resolve(`${name}/package.json`));
}

module.exports = { root, nodeModules, resolve, load, packageDirectory };
