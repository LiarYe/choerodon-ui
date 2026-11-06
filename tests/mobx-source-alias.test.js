const path = require('path');
const fs = require('fs');
const dataset = require('choerodon-ui/dataset').default;
const libDataSet = require('choerodon-ui/pro/lib/data-set').default;
const esDataSet = require('choerodon-ui/pro/es/data-set').default;
const source = require('../components-dataset/data-set').default;

const root = path.resolve(__dirname, '..');
const aliases = [
  ['choerodon-ui', 'components/index.tsx'],
  ['choerodon-ui/lib', 'components/index.tsx'],
  ['choerodon-ui/es', 'components/index.tsx'],
  ['choerodon-ui/lib/configure', 'components/configure/index.tsx'],
  ['choerodon-ui/es/configure', 'components/configure/index.tsx'],
  ['choerodon-ui/pro', 'components-pro/index.tsx'],
  ['choerodon-ui/pro/lib', 'components-pro/index.tsx'],
  ['choerodon-ui/pro/es', 'components-pro/index.tsx'],
  ['choerodon-ui/pro/lib/data-set', 'components-pro/data-set/index.tsx'],
  ['choerodon-ui/pro/es/data-set', 'components-pro/data-set/index.tsx'],
  ['choerodon-ui/dataset', 'components-dataset/index.ts'],
  ['choerodon-ui/dataset/data-set', 'components-dataset/data-set/index.tsx'],
  ['choerodon-ui/shared', 'components-shared/index.ts'],
  ['choerodon-ui/shared/util', 'components-shared/util/index.tsx'],
];

it.each(aliases)('resolves %s to current source %s', (request, source) => {
  expect(fs.realpathSync(require.resolve(request))).toBe(fs.realpathSync(path.join(root, source)));
});

it('shares the source DataSet through package and component aliases', () => {
  expect(dataset).toBe(source);
  expect(libDataSet).toBe(source);
  expect(esDataSet).toBe(source);
});

it('does not load generated library modules', () => {
  const generated = Object.keys(require.cache).filter(file => {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    return /^(lib|es|dist|pro\/(lib|es)|dataset|shared)\//.test(relative);
  });
  expect(generated).toEqual([]);
});
