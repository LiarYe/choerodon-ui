import React from 'react';
import { autorun, isObservable, runInAction, set } from 'mobx';
import DataSet from '../DataSet';
import configure, { getConfig } from '../../../components/configure';

const createConfig = () => {
  const callback = () => null;
  const type = React.memo(callback);
  const node = React.createElement(type, { onClick: callback });
  return { node, callback, nested: { count: 1 }, nodes: [node] };
};

function check(value, source) {
  expect(value.node).toBe(source.node);
  expect(value.node.type).toBe(source.node.type);
  expect(value.callback).toBe(source.callback);
  expect(value.nodes[0]).toBe(source.node);
  expect(isObservable(value.nested)).toBe(true);
  const counts = [];
  const dispose = autorun(() => counts.push(value.nested.count));
  runInAction(() => { value.nested.count = 2; });
  expect(counts).toEqual([1, 2]);
  dispose();
  const next = createConfig();
  runInAction(() => {
    value.node = next.node;
    value.nodes.push(next.node);
    value.callback = next.callback;
  });
  expect(value.node).toBe(next.node);
  expect(value.nodes[1]).toBe(next.node);
  expect(value.callback).toBe(next.callback);
}

describe('React configuration identity', () => {
  it('preserves Field values and subsequent set/reset values', () => {
    const source = createConfig();
    const ds = new DataSet({ fields: [{ name: 'value', label: source.node, highlight: source }] });
    const field = ds.getField('value');
    expect(field.get('label')).toBe(source.node);
    check(field.get('highlight'), source);
    const next = createConfig();
    field.set('label', next.node);
    expect(field.get('label')).toBe(next.node);
    expect(field.pristineProps.label).toBe(source.node);
    field.set('highlight', next);
    check(field.get('highlight'), next);
    field.reset();
    expect(field.get('label')).toBe(source.node);
  });

  it.each(['fields', 'queryFields'])('preserves DataSet.props.%s and later replacements', key => {
    const source = createConfig();
    const ds = new DataSet({ [key]: [{ name: 'value', label: source.node, highlight: source }] });
    expect(ds.props[key][0].label).toBe(source.node);
    check(ds.props[key][0].highlight, source);
    const next = createConfig();
    runInAction(() => set(ds.props, key, [{ name: 'next', highlight: next }]));
    check(ds.props[key][0].highlight, next);
  });

  it('restores dirty nested configuration and keeps it reactive across repeated resets', () => {
    const source = createConfig();
    const field = new DataSet({ fields: [{ name: 'value', highlight: source }] }).getField('value');
    const original = field.get('highlight');
    const snapshots = [];
    const dispose = autorun(() => snapshots.push(field.get('highlight').nested.count));
    try {
      for (let index = 0; index < 2; index += 1) {
        const next = createConfig();
        next.nested.count = 3;
        field.set('highlight', next);
        expect(field.dirtyProps.highlight).toBe(original);
        expect(field.pristineProps.highlight).toBe(original);
        field.reset();
        expect(field.get('highlight')).toBe(original);
        expect(field.get('highlight').node).toBe(source.node);
        expect(field.get('highlight').callback).toBe(source.callback);
        expect(field.dirtyProps).toBeUndefined();
      }
      runInAction(() => { original.nested.count = 2; });
      expect(snapshots).toEqual([1, 3, 1, 3, 1, 2]);
    } finally {
      dispose();
    }
  });

  it('preserves global configure values through repeated writes and merges', () => {
    const previous = getConfig('pagination');
    try {
      const source = createConfig();
      configure({ pagination: source }, false);
      check(getConfig('pagination'), source);
      const next = createConfig();
      configure({ pagination: next });
      check(getConfig('pagination'), next);
    } finally {
      configure({ pagination: previous }, false);
    }
  });
});
