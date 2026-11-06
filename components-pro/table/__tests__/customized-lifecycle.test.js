import assert from 'assert';
import { autorun, configure, runInAction } from 'mobx';
import Table from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';
import DataSet from '../../data-set';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('TableStore customization lifecycle', () => {
  let stores;
  let subscriptions;
  let warn;

  const createStore = (props = {}, config = {}) => {
    const context = ConfigContext._currentValue;
    const table = new Table({
      ...Table.defaultProps, dataSet: new DataSet(), columns: [], queryBar: 'none', ...props,
    }, { ...context, getConfig: key => config[key] || context.getConfig(key) });
    const store = table.tableStore;
    stores.push(store);
    subscriptions.push(autorun(() => [store.customized, store.loading]));
    return store;
  };

  const enable = (store, props = {}) => {
    store.setProps({ ...store.props, customizable: true, customizedCode: 'test', ...props });
    store.customizedLoaded = true;
  };

  beforeEach(() => {
    stores = [];
    subscriptions = [];
    configure({ enforceActions: 'always' });
    warn = jest.spyOn(console, 'warn');
  });

  afterEach(() => {
    subscriptions.forEach(dispose => dispose());
    stores.forEach(store => { store.dispose(); store.saveCustomizedDebounce.cancel(); });
    const warnings = warn.mock.calls.filter(args => args.some(value => /\[MobX\]/.test(String(value))));
    warn.mockRestore();
    configure({ enforceActions: 'observed' });
    assert.strictEqual(warnings.length, 0, JSON.stringify(warnings));
  });

  it('F07 cold first and second instances preserve debounce action, arguments and flush', async () => {
    const verifyInstance = async () => {
      const save = jest.fn(async () => {});
      const store = createStore({}, { tableCustomizedSave: save });
      enable(store);
      const customized = { columns: {}, size: 'small' };
      const otherInfo = { columnDataSet: new DataSet() };
      store.saveCustomizedDebounce(customized, otherInfo);
      await store.saveCustomizedDebounce.flush();
      expect(save).toHaveBeenCalledWith('test', store.customized, 'Table', otherInfo);
      expect(store.customized.size).toBe('small');
      await store.saveCustomized({ columns: {}, size: 'large' });
      expect(store.customized.size).toBe('large');
    };
    await verifyInstance();
    await verifyInstance();
  });

  it.each(['observed', 'always'])('F03 commits Board results atomically under %s actions', async mode => {
    configure({ enforceActions: mode });
    const saved = deferred();
    const loaded = deferred();
    const customizedDS = new DataSet({ data: [{ id: 1, objectVersionNumber: 1 }] });
    const load = jest.fn(() => loaded.promise);
    const store = createStore({}, { tableCustomizedSave: () => saved.promise, tableCustomizedLoad: load });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    const snapshots = [];
    subscriptions.push(autorun(() => snapshots.push([
      store.customized.objectVersionNumber, customizedDS.current.get('objectVersionNumber'),
      store.dataSet.getState('__CUSTOMIZED__')?.objectVersionNumber,
    ])));
    const pending = store.saveCustomized();
    expect(load).not.toHaveBeenCalled();
    saved.resolve();
    await tick();
    loaded.resolve({ id: 1, objectVersionNumber: 2, viewName: 'saved', dataJson: '{"size":"small"}' });
    await pending;
    expect(snapshots).toEqual([[undefined, 1, undefined], [2, 2, 2]]);
    expect(customizedDS.current.get('dataJson')).toEqual({ size: 'small' });
    expect(customizedDS.current.get('viewName')).toBe('saved');
  });

  it('F04 waits for callback and aggregation before settling and clearing loading', async () => {
    const gate = deferred();
    const events = [];
    const store = createStore({
      onCustomizedLoad: () => { events.push('load'); return gate.promise; },
      onAggregationChange: () => events.push('aggregation'),
    });
    enable(store);
    let done = false;
    const pending = store.loadCustomized({ aggregation: true }, true).then(() => { done = true; });
    await tick();
    expect(events).toEqual(['load']);
    expect(done).toBe(false);
    expect(store.loading).toBe(true);
    gate.resolve();
    await pending;
    expect(events).toEqual(['load', 'aggregation']);
    expect(store.loading).toBe(false);
  });

  it.each(['save', 'load', 'parse'])('F03 preserves the %s failure chain without a partial Board commit', async stage => {
    const error = new Error(stage);
    const customizedDS = new DataSet({ data: [{ id: 1, objectVersionNumber: 1 }] });
    const store = createStore({}, {
      tableCustomizedSave: async () => { if (stage === 'save') throw error; },
      tableCustomizedLoad: async () => {
        if (stage === 'load') throw error;
        return { objectVersionNumber: 2, dataJson: '{' };
      },
    });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    await expect(store.saveCustomized()).rejects[stage === 'parse' ? 'toBeInstanceOf' : 'toBe'](stage === 'parse' ? SyntaxError : error);
    expect(customizedDS.current.get('objectVersionNumber')).toBe(1);
    expect(store.customized.objectVersionNumber).toBeUndefined();
  });

  it('F04 rejects callback errors through the returned promise and skips aggregation', async () => {
    const gate = deferred();
    const aggregation = jest.fn();
    const store = createStore({ onCustomizedLoad: () => gate.promise, onAggregationChange: aggregation });
    enable(store);
    const pending = store.loadCustomized({ aggregation: true }, true);
    const error = new Error('callback');
    gate.reject(error);
    await expect(pending).rejects.toBe(error);
    expect(store.loading).toBe(false);
    expect(aggregation).not.toHaveBeenCalled();
  });

  it('F04 stale requests cannot commit or clear the current loading flag', async () => {
    const first = deferred();
    const next = deferred();
    const callback = jest.fn();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const store = createStore({ onCustomizedLoad: callback }, { tableCustomizedLoad: load });
    enable(store);
    const old = store.loadCustomized();
    const current = store.loadCustomized();
    first.resolve({ size: 'small' });
    await old;
    expect(store.loading).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    next.resolve({ size: 'large' });
    await current;
    expect(store.customized.size).toBe('large');
    expect(store.loading).toBe(false);
  });

  it.each(['record', 'props', 'dispose'])('F03 ignores a Board save after %s changes', async change => {
    const gate = deferred();
    const customizedDS = new DataSet({ data: [{ id: 1 }, { id: 2 }] });
    const load = jest.fn(async () => ({ id: 1, objectVersionNumber: 2, dataJson: '{}' }));
    const store = createStore({}, { tableCustomizedSave: () => gate.promise, tableCustomizedLoad: load });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    const pending = store.saveCustomized();
    if (change === 'record') runInAction(() => { customizedDS.current = customizedDS.get(1); });
    if (change === 'props') store.setProps({ ...store.props, dataSet: new DataSet() });
    if (change === 'dispose') store.dispose();
    gate.resolve();
    await pending;
    expect(load).not.toHaveBeenCalled();
    expect(store.customized.objectVersionNumber).toBeUndefined();
  });

  it.each(['record', 'props', 'dispose'])('F04 suppresses late load commits after %s changes', async change => {
    const gate = deferred();
    const customizedDS = new DataSet({ data: [{ id: 1 }, { id: 2 }] });
    const callback = jest.fn();
    const store = createStore({ onCustomizedLoad: callback }, { tableCustomizedLoad: () => gate.promise });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    const pending = store.loadCustomized();
    if (change === 'record') runInAction(() => { customizedDS.current = customizedDS.get(1); });
    if (change === 'props') store.setProps({ ...store.props, customizedCode: 'next' });
    if (change === 'dispose') store.dispose();
    const before = store.customized;
    gate.resolve({ id: 1, objectVersionNumber: 2, dataJson: '{}' });
    await pending;
    expect(store.customized).toBe(before);
    expect(callback).not.toHaveBeenCalled();
    expect(customizedDS.get(0).get('objectVersionNumber')).toBeUndefined();
    expect(customizedDS.get(1).get('objectVersionNumber')).toBeUndefined();
    expect(store.loading).toBe(false);
  });

  it.each(['resolve', 'reject'])('F04 handles a disposed callback %s without aggregation or late writes', async outcome => {
    const gate = deferred();
    const aggregation = jest.fn();
    const store = createStore({ onCustomizedLoad: () => gate.promise, onAggregationChange: aggregation });
    enable(store);
    const pending = store.loadCustomized({ aggregation: true }, true);
    store.dispose();
    const error = new Error('disposed callback');
    gate[outcome](error);
    if (outcome === 'reject') await expect(pending).rejects.toBe(error);
    else await expect(pending).resolves.toBeUndefined();
    expect(aggregation).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });

  it.each(['load', 'parse', 'aggregation'])('F04 propagates %s failures and finishes loading', async stage => {
    const error = new Error(`load ${stage}`);
    const customizedDS = new DataSet({ data: [{ id: 1 }] });
    const store = createStore({ onAggregationChange: async () => { throw error; } }, {
      tableCustomizedLoad: async () => {
        if (stage === 'load') throw error;
        return { objectVersionNumber: 2, dataJson: stage === 'parse' ? '{' : '{"aggregation":true}' };
      },
    });
    enable(store, stage === 'aggregation' ? {} : { boardCustomized: { customizedBtn: true, customizedDS } });
    const pending = stage === 'aggregation' ? store.loadCustomized({ aggregation: true }) : store.loadCustomized();
    if (stage === 'parse') await expect(pending).rejects.toBeInstanceOf(SyntaxError);
    else await expect(pending).rejects.toBe(error);
    expect(store.loading).toBe(false);
    expect(customizedDS.current.get('objectVersionNumber')).toBeUndefined();
  });

  it('reports ignored rejections through the existing warning channel', async () => {
    const error = jest.spyOn(console, 'error');
    try {
      const store = createStore({}, { tableCustomizedLoad: async () => { throw new Error('ignored customization'); } });
      enable(store);
      store.loadCustomized();
      await tick();
      expect(error.mock.calls.some(args => args.some(value => String(value).includes('ignored customization')))).toBe(true);
    } finally { error.mockRestore(); }
  });

  it.each(['save', 'load'])('preserves a pending Board %s across equivalent wrapper props', async operation => {
    const gate = deferred();
    const customizedDS = new DataSet({ data: [{ id: 1 }] });
    const result = { id: 1, objectVersionNumber: 2, dataJson: '{}' };
    const store = createStore({}, {
      tableCustomizedSave: () => gate.promise,
      tableCustomizedLoad: () => operation === 'save' ? Promise.resolve(result) : gate.promise,
    });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    const pending = operation === 'save' ? store.saveCustomized() : store.loadCustomized();
    store.updateProps({ ...store.props, boardCustomized: { customizedBtn: true, customizedDS } });
    if (operation === 'load') expect(store.loading).toBe(true);
    gate.resolve(result);
    await pending;
    expect(customizedDS.current.get('objectVersionNumber')).toBe(2);
    expect(store.dataSet.getState('__CUSTOMIZED__').objectVersionNumber).toBe(2);
    expect(store.loading).toBe(false);
  });

  it.each(['save', 'load'])('invalidates a pending Board %s when its customized dataset changes', async operation => {
    const gate = deferred();
    const customizedDS = new DataSet({ data: [{ id: 1 }] });
    const replacement = new DataSet({ data: [{ id: 2 }] });
    const load = jest.fn(() => gate.promise);
    const store = createStore({}, { tableCustomizedSave: () => gate.promise, tableCustomizedLoad: load });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    const pending = operation === 'save' ? store.saveCustomized() : store.loadCustomized();
    store.updateProps({ ...store.props, boardCustomized: { customizedBtn: true, customizedDS: replacement } });
    gate.resolve({ id: 1, objectVersionNumber: 2, dataJson: '{}' });
    await pending;
    if (operation === 'save') expect(load).not.toHaveBeenCalled();
    expect(customizedDS.current.get('objectVersionNumber')).toBeUndefined();
    expect(replacement.current.get('objectVersionNumber')).toBeUndefined();
    expect(store.customized.objectVersionNumber).toBeUndefined();
    expect(store.loading).toBe(false);
  });

  it('preserves a debounced save across equivalent Board wrapper props', async () => {
    const save = jest.fn(async () => {});
    const customizedDS = new DataSet({ data: [{ id: 1 }] });
    const store = createStore({}, {
      tableCustomizedSave: save,
      tableCustomizedLoad: async () => ({ id: 1, dataJson: '{}' }),
    });
    enable(store, { boardCustomized: { customizedBtn: true, customizedDS } });
    store.saveCustomizedDebounce({ columns: {}, size: 'small' });
    store.updateProps({ ...store.props, boardCustomized: { customizedBtn: true, customizedDS } });
    await store.saveCustomizedDebounce.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('F07 cancels a pending save on disposal rather than flushing it', () => {
    jest.useFakeTimers();
    try {
      const save = jest.fn(async () => {});
      const store = createStore({}, { tableCustomizedSave: save });
      enable(store);
      store.saveCustomizedDebounce();
      store.dispose();
      jest.runOnlyPendingTimers();
      expect(save).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });
});
