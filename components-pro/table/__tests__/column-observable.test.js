import React from 'react';
import { autorun, isObservableArray, isObservableObject, observable, runInAction } from 'mobx';
import Table from '../Table';
import Column from '../Column';
import PerformanceTable from '../../performance-table/Table';
import PerformanceColumn from '../../performance-table/Column';
import ConfigContext from '../../../components/config-provider/ConfigContext';
import DataSet from '../../data-set';

describe.each(['table', 'performance-table'])('%s observable columns', (kind) => {
  const createStore = columns => {
    const Component = kind === 'table' ? Table : PerformanceTable;
    const instance = new Component({
      ...Component.defaultProps,
      columns,
      data: [],
      dataSet: new DataSet(),
      queryBar: kind === 'table' ? 'none' : false,
      pagination: false,
    }, ConfigContext._currentValue);
    instance.forceUpdate = jest.fn();
    const store = instance.tableStore;
    store.initColumns();
    return store;
  };

  it('preserves component static markers, elements and callbacks through nested columns and replacement', () => {
    const Component = kind === 'table' ? Column : PerformanceColumn;
    const marker = kind === 'table' ? '__PRO_TABLE_COLUMN' : '__PFM_TABLE_COLUMN';
    const node = <Component />;
    const callback = () => node;
    callback.staticMarker = true;
    const values = kind === 'table'
      ? { header: node, footer: Component, editor: node, renderer: Component, command: [node], filterPopover: callback }
      : { title: Component, header: node, render: Component, onCell: callback };
    const store = createStore([{ key: 'parent', children: [{ key: 'child', ...values }] }]);
    const column = store.originalColumns[0].children[0];
    Object.keys(values).forEach(key => expect(column[key]).toBe(values[key]));
    const componentKey = kind === 'table' ? 'renderer' : 'render';
    expect(column[componentKey][marker]).toBe(true);
    runInAction(() => { column[componentKey] = callback; });
    expect(column[componentKey]).toBe(callback);
    expect(column[componentKey].staticMarker).toBe(true);
  });

  it('keeps nested columns and ordinary objects deeply reactive', () => {
    const store = createStore([{ key: 'parent', children: [{ key: 'child', width: 100, hidden: false, lock: false, fixed: false, style: { color: 'red' } }] }]);
    const parent = store.originalColumns[0];
    const child = parent.children[0];
    expect(isObservableArray(store.originalColumns)).toBe(true);
    expect(isObservableArray(parent.children)).toBe(true);
    expect(isObservableObject(child)).toBe(true);
    expect(isObservableObject(child.style)).toBe(true);
    const snapshots = [];
    const dispose = autorun(() => snapshots.push([child.width, child.hidden, child.lock, child.fixed, child.style.color]));
    try {
      runInAction(() => {
        child.width = 180;
        child.hidden = true;
        child.lock = 'right';
        child.fixed = 'right';
        child.style.color = 'blue';
      });
      expect(snapshots).toEqual([[100, false, false, false, 'red'], [180, true, 'right', 'right', 'blue']]);
    } finally {
      dispose();
    }
  });

  it('preserves React identities inside nested Map and Set configuration and supports cycles', () => {
    const Component = kind === 'table' ? Column : PerformanceColumn;
    const callback = () => null;
    const type = React.memo(callback);
    const node = <Component />;
    const nested = { callback, type, node };
    nested.self = nested;
    const config = { nested, map: new Map([[nested, nested]]), set: new Set([nested]) };
    const store = createStore([{ key: 'column', config }]);
    const column = store.originalColumns[0];
    expect(column.config.nested).not.toBe(nested);
    expect(column.config.nested.self).toBe(column.config.nested);
    expect(column.config.nested.callback).toBe(callback);
    expect(column.config.nested.type).toBe(type);
    expect(column.config.nested.node).toBe(node);
    const mapEntry = Array.from(column.config.map.entries())[0];
    expect(mapEntry[0]).toBe(nested);
    expect(mapEntry[1]).toBe(column.config.nested);
    expect(Array.from(column.config.set)[0]).toBe(column.config.nested);
    const snapshots = [];
    const dispose = autorun(() => snapshots.push(column.config.nested.count));
    try {
      runInAction(() => { column.config.nested.count = 2; });
      expect(snapshots).toEqual([undefined, 2]);
    } finally {
      dispose();
    }
  });

  it('reproduces static marker loss with the default deep enhancer', () => {
    const Component = kind === 'table' ? Column : PerformanceColumn;
    const marker = kind === 'table' ? '__PRO_TABLE_COLUMN' : '__PFM_TABLE_COLUMN';
    const column = observable({ header: <Component />, renderer: Component });
    expect(column.renderer).not.toBe(Component);
    expect(column.renderer[marker]).toBeUndefined();
    expect(column.header.type).not.toBe(Component);
    expect(column.header.type[marker]).toBeUndefined();
  });

  it.each(['push', 'splice', 'index', 'replace', 'children'])('preserves dynamically added column models through %s', operation => {
    const Component = kind === 'table' ? Column : PerformanceColumn;
    const marker = kind === 'table' ? '__PRO_TABLE_COLUMN' : '__PFM_TABLE_COLUMN';
    const node = <Component />;
    const callback = () => node;
    const store = createStore([{ key: 'parent', children: [{ key: 'old' }] }]);
    const parent = store.originalColumns[0];
    const added = { key: 'added', children: [{ key: 'leaf', header: node, renderer: Component, onCell: callback, width: 100, hidden: false, lock: false }] };
    const snapshots = [];
    const dispose = autorun(() => snapshots.push(parent.children.map(column => column.key)));
    try {
      runInAction(() => {
        if (operation === 'push') parent.children.push(added);
        if (operation === 'splice') parent.children.splice(0, 1, added);
        if (operation === 'index') parent.children[0] = added;
        if (operation === 'replace') parent.children.replace([added]);
        if (operation === 'children') parent.children = [added];
      });
      expect(snapshots).toEqual([['old'], operation === 'push' ? ['old', 'added'] : ['added']]);
      const leaf = parent.children[parent.children.length - 1].children[0];
      expect(leaf.header).toBe(node);
      expect(leaf.header.type[marker]).toBe(true);
      expect(leaf.renderer).toBe(Component);
      expect(leaf.onCell).toBe(callback);
      const states = [];
      const stop = autorun(() => states.push([leaf.width, leaf.hidden, leaf.lock]));
      try {
        runInAction(() => { leaf.width = 200; leaf.hidden = true; leaf.lock = 'left'; });
        expect(states).toEqual([[100, false, false], [200, true, 'left']]);
      } finally {
        stop();
      }
    } finally {
      dispose();
    }
  });

  it('does not inject unrelated React props and preserves late callbacks and React values', () => {
    const store = createStore([{ key: 'column', width: 100 }]);
    const column = store.originalColumns[0];
    expect(Object.keys(column)).not.toContain('tagRenderer');
    const node = <span>Header</span>;
    const callback = () => node;
    runInAction(() => { column.header = node; column.onCell = callback; });
    expect(column.header).toBe(node);
    expect(column.onCell).toBe(callback);
    runInAction(() => { column.header = callback; });
    expect(column.header).toBe(callback);
  });
});
