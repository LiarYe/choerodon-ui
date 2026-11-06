const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');
const SideEffectsFlagPlugin = require('webpack/lib/optimize/SideEffectsFlagPlugin');
const manifest = require('../../package.json');

const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'dist');
const files = fs.readdirSync(directory);
const scripts = files.filter(file => file.endsWith('.js'));
assert.strictEqual(scripts.length, 10);
assert(!files.some(file => /\.variables.*\.js/.test(file)));
scripts.forEach(file => {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  new vm.Script(source, { filename: file });
  assert(source.includes('sourceMappingURL='));
});
files.filter(file => /\.(js|css)$/.test(file)).forEach(file => {
  const map = JSON.parse(fs.readFileSync(path.join(directory, `${file}.map`), 'utf8'));
  assert.strictEqual(map.version, 3);
  assert.strictEqual(map.file, file);
  assert(map.sources.length > 0);
});
['choerodon-ui', 'choerodon-ui-pro'].forEach(name => {
  ['', '.min', '.variables', '.variables.min'].forEach(suffix => {
    const css = fs.readFileSync(path.join(directory, `${name}${suffix}.css`), 'utf8');
    assert(css.length > 100000);
    assert(css.includes(name.endsWith('-pro') ? '.c7n-pro-' : '.c7n-'));
    const selectors = new Set();
    postcss.parse(css).walkRules(rule => {
      assert(rule.selector.trim(), `${name}${suffix}: empty selector`);
      rule.selectors.forEach(selector => selectors.add(selector));
    });
    const expected = name.endsWith('-pro')
      ? ['.c7n-pro-btn', '.c7n-pro-btn-primary.c7n-pro-btn-raised', '.c7n-pro-table']
      : ['.c7n-btn', '.c7n-btn-flat.c7n-btn-primary', '.c7n-alert', '.c7n-select'];
    expected.forEach(selector => assert(selectors.has(selector), `${name}${suffix}: missing ${selector}`));
    if (suffix.includes('variables')) assert(css.includes('var(--'));
  });
});
[
  'dist/choerodon-ui.min.js', 'lib/button/style/index.js', 'es/button/style/css.js',
  'pro/lib/table/style/index.js', 'pro/es/table/style/css.js',
  'lib/style/themes/default.less', 'es/style/v2-compatible-reset.css',
  'components/configure/index.tsx', 'components/configure/index.js',
  'lib/configure/index.js', 'es/configure/index.js',
].forEach(file => {
  assert(SideEffectsFlagPlugin.moduleHasSideEffects(file, manifest.sideEffects, new Map()), file);
});
assert(!SideEffectsFlagPlugin.moduleHasSideEffects('es/button/index.js', manifest.sideEffects, new Map()));

const dependencies = {
  react: 'react/umd/react.production.min.js',
  'react-dom': 'react-dom/umd/react-dom.production.min.js',
  mobx: 'mobx/dist/mobx.umd.production.min.js',
  moment: 'moment/min/moment.min.js',
};
const sources = Object.fromEntries(Object.entries(dependencies).map(([name, request]) => [
  name, fs.readFileSync(require.resolve(request), 'utf8'),
]));

function assertProDefaults(window, value, label) {
  const context = value.Table.contextType._currentValue;
  const getConfig = key => context.getConfig(key);
  assert.strictEqual(typeof getConfig('tableColumnAlign'), 'function', `${label}: tableColumnAlign`);
  assert.strictEqual(typeof getConfig('renderEmpty'), 'function', `${label}: renderEmpty`);
  assert.strictEqual(getConfig('prefixCls'), 'c7n', `${label}: prefixCls`);
  assert.strictEqual(getConfig('proPrefixCls'), 'c7n-pro', `${label}: proPrefixCls`);
  assert.strictEqual(getConfig('tableRowHeight'), 30, `${label}: tableRowHeight`);
  const dataSet = new value.DataSet({
    fields: [{ name: 'amount', type: 'number' }],
    data: [{ amount: 42 }],
  });
  assert.strictEqual(getConfig('tableColumnAlign')({}, dataSet.getField('amount'), dataSet.current), 'right', `${label}: numeric alignment`);
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  try {
    window.ReactDOM.render(window.React.createElement(value.Table, {
      dataSet,
      pagination: false,
      columns: [{ name: 'amount', header: 'Amount' }],
    }), container);
    assert(container.querySelector('.c7n-pro-table'), `${label}: mounted table`);
    assert(container.textContent.includes('42'), `${label}: rendered record`);
  } finally {
    window.ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }
}

for (const file of scripts.filter(name => !name.includes('demo-data-mock'))) {
  for (const format of ['global', 'commonjs', 'amd']) {
    const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
    const { window } = dom;
    try {
      Object.values(sources).forEach(source => window.eval(source));
      const modules = { react: window.React, 'react-dom': window.ReactDOM, mobx: window.mobx, moment: window.moment };
      let value;
      if (format === 'commonjs') {
        window.exports = {};
        window.module = { exports: window.exports };
        window.require = name => {
          assert(Object.prototype.hasOwnProperty.call(modules, name), name);
          return modules[name];
        };
      } else if (format === 'amd') {
        window.define = (names, factory) => {
          value = factory(...names.map(name => {
            assert(Object.prototype.hasOwnProperty.call(modules, name), name);
            return modules[name];
          }));
        };
        window.define.amd = {};
      }
      window.eval(fs.readFileSync(path.join(directory, file), 'utf8'));
      const pro = file.includes('-pro');
      const locales = file.includes('-with-locales');
      const name = locales ? (pro ? 'choerodon-ui/pro' : 'choerodon-ui') : file.slice(0, -3);
      if (format === 'global') value = window[name];
      if (format === 'commonjs') value = window.module.exports;
      assert(value && value.Button && value.Table, `${file}: ${format} exports`);
      if (locales) {
        assert(value.locales && value.locales.zh_CN && value.locales.en_US, `${file}: ${format} locales`);
      }
      if (pro) assertProDefaults(window, value, `${file}: ${format}`);
      console.log(`PASS actual dist ${file}: ${format}, components${locales ? ' + locales' : ''}`);
    } finally {
      window.close();
    }
  }
}
for (const file of scripts.filter(name => name.includes('-pro'))) {
  for (const order of ['pro-only', 'base-pro', 'pro-base']) {
    const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
    const { window } = dom;
    try {
      Object.values(sources).forEach(source => window.eval(source));
      const base = file.replace('-pro', '');
      const sequence = order === 'pro-only' ? [file] : order === 'base-pro' ? [base, file] : [file, base];
      sequence.forEach(name => window.eval(fs.readFileSync(path.join(directory, name), 'utf8')));
      const name = file.includes('-with-locales') ? 'choerodon-ui/pro' : file.slice(0, -3);
      assertProDefaults(window, window[name], `${file}: ${order}`);
      console.log(`PASS actual dist ${file}: ${order}, default UI config + Table mount`);
    } finally {
      window.close();
    }
  }
}
console.log('PASS actual dist JavaScript syntax, source maps, CSS-only themes, styles and publication sideEffects');
