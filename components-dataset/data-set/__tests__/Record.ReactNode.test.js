import React from 'react';
import { createPortal } from 'react-dom';
import { autorun, isObservable, runInAction } from 'mobx';
import DataSet from '../DataSet';
import Record from '../Record';

const createNode = label => React.createElement(React.memo(() => null), { label });

const createData = label => ({
  node: createNode(label),
  detail: { count: 1, node: createNode(label), items: [{ count: 1 }] },
});

function check(record, source) {
  expect(record.get('node')).toBe(source.node);
  expect(record.get('node').type).toBe(source.node.type);
  expect(isObservable(record.get('node'))).toBe(false);
  expect(record.get('detail').node).toBe(source.detail.node);
  const values = [];
  const dispose = autorun(() => {
    const detail = record.get('detail');
    values.push([detail.count, detail.items[0].count]);
  });
  try {
    runInAction(() => { record.get('detail').count = 2; });
    runInAction(() => { record.get('detail').items[0].count = 2; });
    expect(values).toEqual([[1, 1], [2, 1], [2, 2]]);
    const node = createNode('nested replacement');
    runInAction(() => { record.get('detail').node = node; });
    expect(record.get('detail').node).toBe(node);
  } finally {
    dispose();
  }
}

describe('Record ReactNode identity', () => {
  const createDataSet = () => new DataSet({
    fields: [{ name: 'node', type: 'reactNode' }, { name: 'detail', type: 'object' }],
  });

  it.each(['constructor', 'init', 'set', 'commit'])('preserves React elements through %s', method => {
    const ds = createDataSet();
    const source = createData(method);
    const record = new Record(method === 'constructor' ? source : {}, ds);
    if (method === 'commit') {
      record.commit(source, ds);
    } else if (method !== 'constructor') {
      record[method](source);
    }
    check(record, source);
  });

  it('preserves pristine React elements through repeated set/reset cycles', () => {
    const source = createData('original');
    const record = new Record(source, createDataSet());
    for (let index = 0; index < 2; index += 1) {
      record.set(createData(`changed ${index}`));
      expect(record.getPristineValue('node')).toBe(source.node);
      expect(record.getPristineValue('detail').node).toBe(source.detail.node);
      record.reset();
      expect(record.get('node')).toBe(source.node);
      expect(record.get('detail').node).toBe(source.detail.node);
    }
    check(record, source);
  });

  it('observes replacement of initially absent ReactNode fields', () => {
    const record = new Record({}, createDataSet());
    const first = createNode('first');
    const next = createNode('next');
    const values = [];
    const dispose = autorun(() => values.push(record.get('node')));
    try {
      record.init('node', first);
      record.set('node', next);
      record.reset();
      expect(values).toEqual([undefined, first, next, first]);
      expect(values[1]).toBe(first);
      expect(values[2]).toBe(next);
      expect(values[3]).toBe(first);
    } finally {
      dispose();
    }
  });

  it.each(['absent', 'empty', 'dirty'])('preserves opaque leaves in pristineData with %s dirtyData', state => {
    const callback = jest.fn();
    const types = [() => null, React.memo(() => null), React.forwardRef(() => null), React.lazy(() => Promise.resolve({ default: () => null }))];
    const nodes = types.map(type => React.createElement(type, { onClick: callback }));
    const portal = createPortal('portal', document.createElement('div'));
    const ds = new DataSet({ fields: [{ name: 'count', type: 'number', bind: 'detail.count' }] });
    const record = new Record({ detail: { count: 1 }, marker: 1 }, ds);
    if (state === 'empty') {
      record.save();
      record.set('marker', 2);
      record.restore();
      expect(record.dirtyData.size).toBe(0);
    } else if (state === 'dirty') {
      record.set('count', 9);
    }
    const source = { detail: { count: 2, nodes, portal, types, items: [{ count: 1 }] }, marker: 3, map: new Map([['node', nodes[0]]]) };
    record.pristineData = source;
    const detail = record.get('detail');
    nodes.forEach((node, index) => {
      expect(detail.nodes[index]).toBe(node);
      expect(detail.nodes[index].type).toBe(types[index]);
      expect(detail.nodes[index].props.onClick).toBe(callback);
      expect(detail.types[index]).toBe(types[index]);
      expect(isObservable(detail.nodes[index])).toBe(false);
    });
    expect(detail.portal).toBe(portal);
    expect(record.get('map').get('node')).toBe(nodes[0]);
    expect(record.get('marker')).toBe(3);
    expect(record.get('count')).toBe(state === 'dirty' ? 9 : 2);
    if (state === 'dirty') {
      expect(record.dirtyData.get('detail.count')).toBe(2);
      expect(record.getPristineValue('count')).toBe(2);
    }
    const values = [];
    const dispose = autorun(() => values.push(record.get('detail').items[0].count));
    try {
      runInAction(() => { detail.items[0].count = 4; });
      expect(values).toEqual([1, 4]);
    } finally {
      dispose();
    }
    record.reset();
    expect(record.get('count')).toBe(2);
    expect(record.get('detail').nodes[0]).toBe(nodes[0]);
    record.commit(source, ds);
    expect(record.get('detail').portal).toBe(portal);
    expect(record.get('detail').nodes[0]).toBe(nodes[0]);
  });

  it('replaces React leaves atomically while retaining edited nested paths', () => {
    const original = createNode('original');
    const edited = React.createElement('span', { onClick: jest.fn() });
    const incoming = React.createElement('div', { title: 'server' });
    const ds = new DataSet({ fields: [{ name: 'node', type: 'reactNode', bind: 'detail.node' }] });
    const record = new Record({ detail: { node: original, count: 1 } }, ds);
    record.set('node', edited);
    record.pristineData = { detail: { node: incoming, count: 2 } };
    expect(record.get('node')).toBe(edited);
    expect(record.get('detail').count).toBe(2);
    expect(record.getPristineValue('node')).toBe(incoming);
    record.reset();
    expect(record.get('node')).toBe(incoming);
    record.set('node', edited);
    record.pristineData = { detail: { node: edited, count: 3 } };
    expect(record.dirtyData.size).toBe(0);
    expect(record.get('node')).toBe(edited);
  });

  it('retains childrenField reference semantics', () => {
    const children = [{ id: 2 }];
    const ds = new DataSet({ childrenField: 'children' });
    const record = new Record({ children }, ds);
    expect(record.data.children).toBe(children);
    expect(isObservable(record.data.children)).toBe(false);
  });
});
