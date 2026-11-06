import React from 'react';
import { createPortal } from 'react-dom';
import { autorun, isAction, isComputedProp, isObservableProp, observable, runInAction, set } from 'mobx';
import observableConfig, { observableConfigMap } from '../observableConfig';

describe('observableConfig', () => {
  describe.each([
    ['MobX', source => observable(source)],
    ['helper', source => observableConfig(source)],
  ])('%s property semantics', (name, convert) => {
    it.each([true, false])('keeps getters lazy and computed with enumerable=%s and the converted object as this', enumerable => {
      const getter = jest.fn(function getTotal() { return this.count * 2; });
      const source = { count: 1 };
      Object.defineProperty(source, 'total', { get: getter, configurable: true, enumerable });
      const value = convert(source);
      expect(getter).not.toHaveBeenCalled();
      expect(isComputedProp(value, 'total')).toBe(true);
      const totals = [];
      const dispose = autorun(() => totals.push(value.total));
      try {
        expect(value.total).toBe(2);
        expect(getter).toHaveBeenCalledTimes(1);
        runInAction(() => { value.count = 2; });
        expect(totals).toEqual([2, 4]);
        expect(getter.mock.instances).toEqual([value, value]);
        expect(source.count).toBe(1);
      } finally {
        dispose();
      }
    });

    it('preserves getter/setter pairs and action-wrapped setter-only properties', () => {
      const value = convert({
        count: 1,
        get total() { return this.count * 2; },
        set total(next) { this.count = next / 2; },
        set increment(next) { this.count += next; },
      });
      expect(isComputedProp(value, 'total')).toBe(true);
      expect(isAction(Object.getOwnPropertyDescriptor(value, 'increment').set)).toBe(true);
      const totals = [];
      const dispose = autorun(() => totals.push(value.total));
      try {
        value.total = 6;
        value.increment = 2;
        expect(value.increment).toBeUndefined();
        expect(value.count).toBe(5);
        expect(totals).toEqual([2, 6, 10]);
      } finally {
        dispose();
      }
    });

    it('tracks Symbol data and accessor properties including non-enumerable keys', () => {
      const data = Symbol('data');
      const total = Symbol('total');
      const source = {};
      Object.defineProperties(source, {
        [data]: { value: { count: 1 }, configurable: true },
        [total]: {
          get() { return this[data].count * 2; },
          set(next) { this[data].count = next / 2; },
          configurable: true,
        },
      });
      const value = convert(source);
      expect(isObservableProp(value, data)).toBe(true);
      expect(isComputedProp(value, total)).toBe(true);
      const totals = [];
      const dispose = autorun(() => totals.push(value[total]));
      try {
        value[total] = 4;
        runInAction(() => { value[data] = { count: 3 }; });
        runInAction(() => { value[data].count = 4; });
        expect(totals).toEqual([2, 4, 6, 8]);
        expect(source[data].count).toBe(1);
      } finally {
        dispose();
      }
    });
  });

  it('preserves React identity and cyclic aliases through Symbol properties and later writes', () => {
    const key = Symbol('config');
    const node = React.createElement('span');
    const type = React.memo(() => null);
    const source = { count: 1, node, type };
    source[key] = source;
    const value = observableConfig({ [key]: source, alias: source });
    expect(value[key]).toBe(value.alias);
    expect(value[key][key]).toBe(value[key]);
    expect(value[key].node).toBe(node);
    expect(value[key].type).toBe(type);
    const original = value[key];
    const counts = [];
    const dispose = autorun(() => counts.push(value[key].count));
    try {
      source.count = 2;
      runInAction(() => { value[key] = source; });
      expect(value[key]).not.toBe(original);
      expect(value[key][key]).toBe(value[key]);
      expect(value[key].node).toBe(node);
      expect(value[key].type).toBe(type);
      runInAction(() => { value[key].count = 3; });
      expect(counts).toEqual([1, 2, 3]);
      expect(original.count).toBe(1);
    } finally {
      dispose();
    }
  });

  it('keeps React leaves, component types and callbacks opaque', () => {
    const callback = () => null;
    const types = [callback, React.memo(callback), React.forwardRef(callback), React.lazy(() => Promise.resolve({ default: callback }))];
    const nodes = types.map(type => React.createElement(type, { onClick: callback }));
    nodes.push(createPortal('portal', document.createElement('div')));
    const source = { nodes, types, callback };
    const value = observableConfig(source);
    nodes.forEach((node, index) => expect(value.nodes[index]).toBe(node));
    types.forEach((type, index) => expect(value.types[index]).toBe(type));
    expect(value.callback).toBe(callback);
    expect(source.nodes).toBe(nodes);
    const map = observableConfigMap();
    runInAction(() => map.set('value', source));
    expect(map.get('value').nodes[0]).toBe(nodes[0]);
    const original = map.get('value');
    runInAction(() => map.set('value', source));
    expect(map.get('value')).not.toBe(original);
    nodes.forEach((node, index) => expect(map.get('value').nodes[index]).toBe(node));
    types.forEach((type, index) => expect(map.get('value').types[index]).toBe(type));
    expect(map.get('value').callback).toBe(callback);
    runInAction(() => map.set('value', nodes[1]));
    expect(map.get('value')).toBe(nodes[1]);
  });

  it('converts later object, array, map and set writes and supports cycles', () => {
    const source = { items: [], map: new Map(), set: new Set() };
    source.self = source;
    const value = observableConfig(source);
    expect(value.self).toBe(value);
    const node = React.createElement('span');
    runInAction(() => {
      set(value, 'added', { count: 1, node });
      value.items.push({ count: 1, node });
      value.map.set('key', { count: 1, node });
      value.set.add({ count: 1, node });
    });
    const entries = [value.added, value.items[0], value.map.get('key'), Array.from(value.set)[0]];
    entries.forEach(entry => {
      expect(entry.node).toBe(node);
      const counts = [];
      const dispose = autorun(() => counts.push(entry.count));
      runInAction(() => { entry.count = 2; });
      expect(counts).toEqual([1, 2]);
      dispose();
    });
    runInAction(() => { value.items[0] = { node }; });
    expect(value.items[0].node).toBe(node);
  });

  it('preserves aliases and mixed container cycles without converting Map keys', () => {
    const key = {};
    const source = { count: 1 };
    source.items = [source];
    source.map = new Map([[key, source]]);
    source.set = new Set([source]);
    const value = observableConfig(source);
    expect(value.items[0]).toBe(value);
    expect(value.map.get(key)).toBe(value);
    expect(Array.from(value.map.keys())[0]).toBe(key);
    expect(Array.from(value.set)[0]).toBe(value);
    const states = [];
    const dispose = autorun(() => states.push([value.map.size, value.set.size, value.map.get(key).count]));
    try {
      runInAction(() => { value.count = 2; });
      runInAction(() => { value.map.set('alias', value); value.set.add(value); });
      expect(value.map.get('alias')).toBe(value);
      expect(value.set.size).toBe(1);
      expect(states).toEqual([[1, 1, 1], [1, 1, 2], [2, 1, 2]]);
      runInAction(() => { value.map.delete('alias'); value.set.delete(value); });
      expect(value.map.size).toBe(1);
      expect(value.set.size).toBe(0);
    } finally {
      dispose();
    }
  });

  it.each([
    ['object', source => observableConfig({ item: source }), value => value.item, (value, source) => { value.item = source; }],
    ['array index', source => observableConfig([source]), value => value[0], (value, source) => { value[0] = source; }],
    ['array splice', source => observableConfig([source]), value => value[0], (value, source) => value.splice(0, 1, source)],
    ['map', source => observableConfig(new Map([['item', source]])), value => value.get('item'), (value, source) => value.set('item', source)],
    ['set', source => observableConfig(new Set([source])), value => Array.from(value)[0], (value, source) => { value.clear(); value.add(source); }],
  ])('reads current source contents on later %s writes', (name, create, read, write) => {
    const node = React.createElement('span');
    const source = { count: 1, nested: { count: 1 }, node };
    source.self = source;
    source.alias = source.nested;
    source.items = [source];
    source.map = new Map([[node, source]]);
    source.set = new Set([source]);
    const value = create(source);
    const original = read(value);
    const counts = [];
    const dispose = autorun(() => counts.push(read(value).nested.count));
    try {
      source.count = 2;
      source.nested.count = 2;
      runInAction(() => write(value, source));
      expect(read(value).count).toBe(2);
      expect(read(value).nested.count).toBe(2);
      expect(read(value)).not.toBe(original);
      expect(original.count).toBe(1);
      expect(read(value).self).toBe(read(value));
      expect(read(value).node).toBe(node);
      expect(read(value).alias).toBe(read(value).nested);
      expect(read(value).items[0]).toBe(read(value));
      expect(read(value).map.get(node)).toBe(read(value));
      expect(Array.from(read(value).set)[0]).toBe(read(value));
      source.nested.count = 3;
      runInAction(() => write(value, source));
      runInAction(() => { read(value).nested.count = 4; });
      expect(counts).toEqual([1, 2, 3, 4]);
    } finally {
      dispose();
    }
  });

  it('shares aliases within a splice but takes fresh snapshots across writes', () => {
    const source = { count: 1 };
    const other = { source };
    source.other = other;
    const value = observableConfig([]);
    runInAction(() => value.push(source, source, other));
    const original = value[0];
    expect(value[1]).toBe(original);
    expect(original.other).toBe(value[2]);
    expect(value[2].source).toBe(original);
    source.count = 2;
    runInAction(() => value.splice(0, 3, source, source, other));
    expect(value[0]).not.toBe(original);
    expect(value[0].count).toBe(2);
    expect(value[1]).toBe(value[0]);
    expect(value[0].other).toBe(value[2]);
    expect(value[2].source).toBe(value[0]);
    expect(original.count).toBe(1);
  });

  it('does not reuse plain source identity across writes in the same action', () => {
    const source = { count: 1 };
    const value = observableConfig({ map: new Map(), set: new Set() });
    runInAction(() => {
      value.map.set('first', source);
      value.set.add(source);
      source.count = 2;
      value.map.set('second', source);
      value.set.add(source);
    });
    expect(value.map.get('first').count).toBe(1);
    expect(value.map.get('second').count).toBe(2);
    expect(Array.from(value.set).map(item => item.count)).toEqual([1, 2]);
    runInAction(() => {
      value.map.set('alias', value.map.get('first'));
      value.set.add(Array.from(value.set)[0]);
    });
    expect(value.map.get('alias')).toBe(value.map.get('first'));
    expect(value.set.size).toBe(2);
  });

  it('preserves existing observables and class instances', () => {
    class Config {}
    const instance = new Config();
    const nested = observable({ count: 1 });
    const value = observableConfig({ nested, instance });
    expect(value.nested).toBe(nested);
    expect(value.instance).toBe(instance);
  });
});
