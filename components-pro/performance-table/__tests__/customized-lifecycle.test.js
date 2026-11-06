import React from 'react';
import assert from 'assert';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { configure } from 'mobx';
import PerformanceTable from '../Table';
import TableStore from '../TableStore';
import ConfigContext from '../../../components/config-provider/ConfigContext';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const customized = width => ({ columns: { name: { width } } });
const columns = Object.freeze([{ key: 'name', dataIndex: 'name', title: 'Name', width: 100 }]);
const context = ConfigContext._currentValue;
const withLoad = load => ({ ...context, getConfig: key => key === 'tableCustomizedLoad' ? load : context.getConfig(key) });

describe('PerformanceTable customization request lifecycle', () => {
  let wrappers;
  let stores;
  let warn;

  const render = (load, props = {}) => {
    const value = withLoad(load);
    const tableProps = {
      columns, data: [{ key: '1', name: 'First' }], rowSelection: {}, customizedCode: 'first',
      customizable: true, queryBar: false, width: 500, height: 300, virtualized: false, ...props,
    };
    const tree = (nextProps = tableProps, nextValue = value) => (
      <ConfigContext.Provider value={nextValue}><PerformanceTable {...nextProps} /></ConfigContext.Provider>
    );
    const wrapper = mount(tree());
    wrappers.push(wrapper);
    const node = wrapper.find(PerformanceTable).instance();
    const store = node.tableStore;
    return { wrapper, node, store, tree, tableProps, value };
  };

  const bareStore = (config = {}) => {
    const node = {
      props: { columns, customizable: false, customizedCode: 'direct' },
      context: { ...context, getConfig: key => config[key] || context.getConfig(key) },
      forceUpdate: jest.fn(),
    };
    const store = new TableStore(node);
    stores.push(store);
    store.syncProps({ ...node.props, customizable: true }, node.context);
    return store;
  };

  beforeEach(() => {
    wrappers = [];
    stores = [];
    configure({ enforceActions: 'observed' });
    warn = jest.spyOn(console, 'warn');
  });

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount());
    stores.forEach(store => {
      if (store.dispose) store.dispose();
      else store.saveCustomizedDebounce.cancel();
    });
    const warnings = warn.mock.calls.filter(args => args.some(value => /\[MobX\]/.test(String(value))));
    warn.mockRestore();
    configure({ enforceActions: 'observed' });
    assert.strictEqual(warnings.length, 0);
  });

  it('S03 switches codes with stable columns and ignores the late old response', async () => {
    const first = deferred();
    const second = deferred();
    const load = jest.fn(code => code === 'first' ? first.promise : second.promise);
    const onChange = jest.fn();
    const { wrapper, store, tree, tableProps } = render(load, { rowSelection: { onChange } });
    wrapper.setProps({ children: tree({ ...tableProps, customizedCode: 'second' }).props.children });
    expect(load.mock.calls.map(args => args[0])).toContain('second');
    await act(async () => { second.resolve(customized(200)); await tick(); });
    expect(store.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name']);
    expect(store.originalColumns[1].width).toBe(200);
    const snapshot = store.customized;
    await act(async () => { first.resolve(customized(120)); await tick(); });
    wrapper.update();
    expect(store.customized).toBe(snapshot);
    expect(store.originalColumns[1].width).toBe(200);
    expect(wrapper.find('input[type="checkbox"]').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('First');
    wrapper.find('input[type="checkbox"]').last().simulate('change', { target: { checked: true }, nativeEvent: { shiftKey: false } });
    wrapper.update();
    expect(onChange.mock.calls[0][0]).toEqual(['1']);
  });

  it('keeps loading owned by the latest same-code request', async () => {
    const requests = [];
    const load = jest.fn(() => { const request = deferred(); requests.push(request); return request.promise; });
    const { store } = render(load);
    const first = store.loadCustomized();
    const oldRequest = requests[requests.length - 1];
    const second = store.loadCustomized();
    const currentRequest = requests[requests.length - 1];
    await act(async () => { oldRequest.resolve(customized(120)); await first; });
    expect(store.loading).toBe(true);
    expect(store.customized.columns.name).toBeUndefined();
    await act(async () => { currentRequest.resolve(customized(200)); await second; });
    expect(store.loading).toBe(false);
    expect(store.originalColumns[1].width).toBe(200);
  });

  it('keeps the latest successful columns after an older internal request rejects', async () => {
    const first = deferred();
    const second = deferred();
    const load = jest.fn(code => code === 'first' ? first.promise : second.promise);
    const { wrapper, store, tree, tableProps, node } = render(load);
    wrapper.setProps(tree({ ...tableProps, customizedCode: 'second' }).props);
    await act(async () => { second.resolve(customized(240)); await tick(); });
    const snapshot = store.customized;
    const update = jest.spyOn(node, 'forceUpdate');
    try {
      await act(async () => { first.reject(new Error('obsolete load')); await tick(); });
      expect(store.customized).toBe(snapshot);
      expect(store.originalColumns[1].width).toBe(240);
      expect(store.loading).toBe(false);
      expect(update).not.toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
  });

  it('does not reload equivalent props or context, but reloads a new same-code loader', async () => {
    const first = deferred();
    const second = deferred();
    const load = jest.fn(() => first.promise);
    const nextLoad = jest.fn(() => second.promise);
    const { wrapper, store, tree, tableProps } = render(load);
    const count = load.mock.calls.length;
    wrapper.setProps(tree({ ...tableProps, className: 'equivalent' }, withLoad(load)).props);
    expect(load).toHaveBeenCalledTimes(count);
    wrapper.setProps(tree(tableProps, withLoad(nextLoad)).props);
    expect(nextLoad).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(customized(120)); await tick(); });
    expect(store.loading).toBe(true);
    await act(async () => { second.resolve(customized(210)); await tick(); });
    expect(store.originalColumns[1].width).toBe(210);
    expect(store.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name']);
  });

  it('reloads replaced columns with the same code and keeps selection removal', async () => {
    const requests = [];
    const load = jest.fn(() => { const request = deferred(); requests.push(request); return request.promise; });
    const { wrapper, store, tree, tableProps } = render(load);
    const old = requests.slice();
    const nextColumns = Object.freeze([{ ...columns[0], title: 'Replacement', width: 110 }]);
    wrapper.setProps(tree({ ...tableProps, columns: nextColumns, rowSelection: undefined }).props);
    const latest = requests[requests.length - 1];
    expect(old).not.toContain(latest);
    await act(async () => { latest.resolve(customized(230)); await tick(); });
    await act(async () => { old.forEach(request => request.resolve(customized(120))); await tick(); });
    wrapper.update();
    expect(store.originalColumns.map(column => column.key)).toEqual(['name']);
    expect(store.originalColumns[0].width).toBe(230);
    expect(wrapper.find('input[type="checkbox"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Replacement');
    expect(columns[0].width).toBe(100);
    expect(nextColumns[0].width).toBe(110);
  });

  it('invalidates pending loads when customization is disabled', async () => {
    const gate = deferred();
    const { wrapper, store, tree, tableProps } = render(() => gate.promise);
    wrapper.setProps(tree({ ...tableProps, customizable: false }).props);
    const snapshot = store.customized;
    expect(store.loading).toBe(false);
    await act(async () => { gate.resolve(customized(170)); await tick(); });
    expect(store.customized).toBe(snapshot);
    expect(store.originalColumns[1].width).toBe(100);
  });

  it.each(['resolve', 'reject'])('S04 ignores an internal %s after unmount', async outcome => {
    const gate = deferred();
    const { wrapper, store, node } = render(() => gate.promise);
    const error = new Error('unmounted load');
    wrapper.unmount();
    wrappers = [];
    const snapshot = store.customized;
    const loading = store.loading;
    const update = jest.spyOn(node, 'forceUpdate');
    const errors = jest.spyOn(console, 'error');
    try {
      await act(async () => { gate[outcome](outcome === 'resolve' ? customized(190) : error); await tick(); });
      expect(store.customized).toBe(snapshot);
      expect(store.loading).toBe(loading);
      expect(update).not.toHaveBeenCalled();
      expect(errors.mock.calls.filter(args => args.some(value => /unmounted component/.test(String(value))))).toEqual([]);
    } finally {
      update.mockRestore();
      errors.mockRestore();
    }
  });

  it('preserves direct load rejection and clears loading without initializing columns', async () => {
    const gate = deferred();
    const store = bareStore({ tableCustomizedLoad: () => gate.promise });
    const snapshot = store.customized;
    const pending = store.loadCustomized();
    const error = new Error('load failed');
    gate.reject(error);
    await expect(pending).rejects.toBe(error);
    expect(store.loading).toBe(false);
    expect(store.customized).toBe(snapshot);
    expect(store.node.forceUpdate).not.toHaveBeenCalled();
  });

  it.each(['throw', 'reject'])('handles an internal load %s without committing or updating', async outcome => {
    const error = new Error('internal load failed');
    const load = jest.fn(() => { if (outcome === 'throw') throw error; return Promise.reject(error); });
    const { store, node } = render(load);
    const snapshot = store.customized;
    const update = jest.spyOn(node, 'forceUpdate');
    try {
      await act(async () => { await tick(); });
      expect(store.loading).toBe(false);
      expect(store.customized).toBe(snapshot);
      expect(update).not.toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
  });

  it.each(['superseded', 'disposed'])('preserves a direct rejection after the request is %s', async change => {
    const requests = [];
    const store = bareStore({ tableCustomizedLoad: () => {
      const request = deferred();
      requests.push(request);
      return request.promise;
    } });
    const old = store.loadCustomized();
    let current;
    if (change === 'disposed') store.dispose();
    else current = store.loadCustomized();
    const snapshot = store.customized;
    const error = new Error('late rejection');
    requests[0].reject(error);
    await expect(old).rejects.toBe(error);
    expect(store.customized).toBe(snapshot);
    expect(store.loading).toBe(change === 'superseded');
    expect(store.node.forceUpdate).not.toHaveBeenCalled();
    if (current) {
      requests[1].reject(error);
      await expect(current).rejects.toBe(error);
      expect(store.loading).toBe(false);
    }
  });

  it.each([false, true])('T01 preserves loaded columns and pending saves across sorting with removed selection %s', async selection => {
    const title = <span>Name</span>;
    const renderer = ({ rowData }) => <strong>{rowData.name}</strong>;
    const stableColumns = Object.freeze([
      Object.freeze({ key: 'name', dataIndex: 'name', title, render: renderer, width: 100 }),
      Object.freeze({ key: 'secret', dataIndex: 'secret', title: 'Secret', width: 100 }),
      Object.freeze({ key: 'age', dataIndex: 'age', title: 'Age', width: 80 }),
    ]);
    const load = jest.fn(() => Promise.resolve({ columns: {
      name: { width: 200, sort: 1 }, secret: { hidden: true, sort: 2 }, age: { sort: 0 },
    } }));
    const saveGate = deferred();
    const save = jest.fn(() => saveGate.promise);
    const onChange = jest.fn();
    const { wrapper, store, tree, tableProps, value } = render(load, {
      columns: stableColumns, rowSelection: selection ? { onChange } : undefined,
      data: [{ key: '1', name: 'First', secret: 'hidden-data', age: 42 }],
    });
    const saveContext = { ...value, getConfig: key => key === 'tableCustomizedSave' ? save : value.getConfig(key) };
    await act(async () => { await tick(); });
    wrapper.setProps(tree(tableProps, saveContext).props);
    const snapshot = store.customized;
    const check = selected => {
      wrapper.update();
      expect(store.originalColumns.map(column => column.key)).toEqual(selected ? ['rowSelection', 'age', 'name', 'secret'] : ['age', 'name', 'secret']);
      const name = store.originalColumns.find(column => column.key === 'name');
      expect(name.width).toBe(200);
      expect(name.title).toBe(title);
      expect(name.render).toBe(renderer);
      expect(store.originalColumns.find(column => column.key === 'secret').hidden).toBe(true);
      expect(wrapper.text()).not.toMatch(/Secret|hidden-data/);
      const host = wrapper.find('strong').first().getDOMNode().closest('[role="grid"]');
      const cell = wrapper.find('strong').first().getDOMNode().closest('[role="gridcell"]');
      expect(cell.style.width).toBe('200px');
      expect(host.textContent.indexOf('Age')).toBeLessThan(host.textContent.indexOf('Name'));
      expect(store.customized).toBe(snapshot);
      expect(load).toHaveBeenCalledTimes(1);
      expect(stableColumns[0].width).toBe(100);
      expect(stableColumns.map(column => column.key)).toEqual(['name', 'secret', 'age']);
    };
    check(selection);
    if (selection) {
      wrapper.find('input[type="checkbox"]').last().simulate('change', { target: { checked: true }, nativeEvent: { shiftKey: false } });
      expect(onChange.mock.calls[0][0]).toEqual(['1']);
    }
    store.saveCustomizedDebounce();
    let next = { ...tableProps, rowSelection: undefined };
    wrapper.setProps(tree(next, saveContext).props);
    check(false);
    expect(wrapper.find('input[type="checkbox"]')).toHaveLength(0);
    for (const patch of [{ sortColumn: 'name' }, { sortType: 'asc' }, { sortType: 'desc' }, { customizedColumnProps: ['width', 'hidden'] }]) {
      next = { ...next, ...patch };
      wrapper.setProps(tree(next, saveContext).props);
      check(false);
    }
    const pending = store.saveCustomizedDebounce.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]).toEqual(['first', snapshot, 'PerformanceTable', undefined]);
    expect(save.mock.calls[0][1]).toBe(snapshot);
    wrapper.setProps(tree({ ...next, sortType: 'asc' }, saveContext).props);
    await act(async () => { saveGate.resolve('saved'); await expect(pending).resolves.toBe('saved'); });
    check(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('T01 keeps an in-flight load valid across sorting and selection removal', async () => {
    const gate = deferred();
    const load = jest.fn(() => gate.promise);
    const stableColumns = Object.freeze([
      Object.freeze({ key: 'name', dataIndex: 'name', title: 'Name', width: 100 }),
      Object.freeze({ key: 'secret', dataIndex: 'secret', title: 'Secret', width: 100 }),
    ]);
    const { wrapper, store, tree, tableProps } = render(load, {
      columns: stableColumns,
      data: [{ key: '1', name: 'First', secret: 'hidden-data' }],
    });
    let next = tableProps;
    for (const patch of [{ sortColumn: 'name' }, { sortType: 'asc' }, { rowSelection: undefined }, { customizedColumnProps: ['width', 'hidden'] }]) {
      next = { ...next, ...patch };
      wrapper.setProps(tree(next).props);
      expect(load).toHaveBeenCalledTimes(1);
      expect(store.loading).toBe(true);
    }
    await act(async () => {
      gate.resolve({ columns: { name: { width: 220 }, secret: { hidden: true } } });
      await tick();
    });
    wrapper.update();
    expect(store.loading).toBe(false);
    expect(store.originalColumns.map(column => column.key)).toEqual(['name', 'secret']);
    expect(store.originalColumns[0].width).toBe(220);
    expect(wrapper.find('[role="gridcell"]').hostNodes().someWhere(cell => cell.text() === 'First' && cell.getDOMNode().style.width === '220px')).toBe(true);
    expect(wrapper.text()).not.toMatch(/Secret|hidden-data/);
    expect(wrapper.find('input[type="checkbox"]')).toHaveLength(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(stableColumns[0].width).toBe(100);
  });

  it.each(['throw', 'reject'])('preserves direct save %s and handles ignored debounced failures', async outcome => {
    const error = new Error('save failed');
    const save = jest.fn(() => { if (outcome === 'throw') throw error; return Promise.reject(error); });
    const store = bareStore({ tableCustomizedLoad: () => new Promise(() => {}), tableCustomizedSave: save });
    await expect(store.saveCustomized(customized(140))).rejects.toBe(error);
    store.saveCustomizedDebounce(customized(180));
    store.saveCustomizedDebounce.flush();
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
    expect(store.customized.columns.name.width).toBe(180);
  });
});
