import { computed, observable, runInAction } from 'mobx';
import DataSet from '../DataSet';
import { sortData, sortTree } from '../utils';
import { LovCodeStore } from '../../stores/LovCodeStore';

describe('data layer sorting', () => {
  it.each(['direct', 'computed'])('derives LOV fields in %s context without reordering cached rules', context => {
    const store = new LovCodeStore();
    runInAction(() => {
      store.lovCodes.set('sorting', {
        valueField: 'later',
        lovItems: [
          { gridFieldName: 'later', conditionFieldSequence: 2, conditionField: 'Y', gridField: 'Y' },
          { gridFieldName: 'first', conditionFieldSequence: 1, conditionField: 'Y', gridField: 'Y' },
          { gridFieldName: 'tied', conditionFieldSequence: 2, conditionField: 'Y', gridField: 'Y' },
        ],
      });
    });
    const config = store.getConfig('sorting');
    const source = config.lovItems.slice();
    const derive = () => store.getLovDataSet('sorting');
    const derived = computed(derive, { keepAlive: true });
    const dataSet = context === 'computed' ? derived.get() : derive();
    expect(dataSet.props.queryFields.map(field => field.name)).toEqual(['first', 'later', 'tied']);
    expect(dataSet.props.fields.map(field => field.name)).toEqual(['first', 'later', 'tied']);
    expect(config.lovItems.slice()).toEqual(source);
    config.lovItems.forEach((item, index) => expect(item).toBe(source[index]));
    expect(derive().props.queryFields.map(field => field.name)).toEqual(['first', 'later', 'tied']);
    expect(config.lovItems.slice()).toEqual(source);
  });

  it.each([false, true])('sorts raw data without mutating source arrays (observable: %s)', useObservable => {
    const dataSet = new DataSet({ paging: false, childrenField: 'children', fields: [{ name: 'id', order: 'asc' }] });
    const raw = [{ id: 2, children: [{ id: 4 }, { id: 3 }] }, { id: 1 }];
    const source = useObservable ? observable.array(raw) : raw;
    const parent = source[0];
    const children = parent.children;
    const result = computed(() => sortData(source, dataSet), { keepAlive: true }).get();
    expect(result.map(item => item.id)).toEqual([1, 2]);
    expect(result[1].children.map(item => item.id)).toEqual([3, 4]);
    expect(source.map(item => item.id)).toEqual([2, 1]);
    expect(parent.children).toBe(children);
    expect(children.map(item => item.id)).toEqual([4, 3]);
    expect(result[1].children[0]).toBe(children[1]);
  });

  it.each(['loadData', 'appendData', 'data'])('%s consumes sorted results and exposes them to before events without changing input', method => {
    const dataSet = new DataSet({ paging: false, childrenField: 'children', fields: [{ name: 'id', order: 'asc' }] });
    const children = Object.freeze([{ id: 4 }, { id: 3 }]);
    const parent = Object.freeze({ id: 2, children });
    const source = Object.freeze([parent, { id: 1 }]);
    const before = jest.fn(({ data }) => {
      expect(data.map(item => item.id)).toEqual([1, 2]);
      expect(data[1].children.map(item => item.id)).toEqual([3, 4]);
    });
    dataSet.addEventListener(method === 'appendData' ? 'beforeAppend' : 'beforeLoad', before);
    if (method === 'data') {
      dataSet.data = source;
    } else {
      dataSet[method](source);
    }
    expect(before).toHaveBeenCalledTimes(1);
    expect(dataSet.treeData.map(record => record.get('id'))).toEqual([1, 2]);
    expect(dataSet.treeData[1].children.map(record => record.get('id'))).toEqual([3, 4]);
    expect(source.map(item => item.id)).toEqual([2, 1]);
    expect(source[0]).toBe(parent);
    expect(parent.children).toBe(children);
    expect(children.map(item => item.id)).toEqual([4, 3]);
  });

  it.each(['loadData', 'appendData', 'data'])('%s preserves tree Record identity and borrowed arrays', async method => {
    const dataSet = new DataSet({
      paging: false,
      childrenField: 'children',
      fields: [{ name: 'rank', type: 'number' }],
      data: [{ rank: 2, children: [{ rank: 4 }, { rank: 3 }] }, { rank: 1 }],
    });
    const source = Object.freeze(dataSet.treeData.slice());
    const [parent, sibling] = source;
    const children = parent.children;
    const originalChildren = children.slice();
    parent.set('rank', 5);
    parent.setState('identity', 'preserved');
    const status = parent.status;
    dataSet.getField('rank').order = 'asc';
    const before = jest.fn();
    dataSet.addEventListener(method === 'appendData' ? 'beforeAppend' : 'beforeLoad', before);
    if (method === 'data') {
      dataSet.data = source;
    } else {
      dataSet[method](source);
    }
    expect(before).toHaveBeenCalledTimes(1);
    const eventData = before.mock.calls[0][0].data;
    expect(eventData[0]).toBe(parent);
    expect(eventData[1]).toBe(sibling);
    expect(dataSet.treeData[0]).toBe(parent);
    expect(dataSet.treeData[1]).toBe(sibling);
    expect(parent.get('rank')).toBe(5);
    expect(parent.getState('identity')).toBe('preserved');
    expect(parent.status).toBe(status);
    expect(parent.children).toBe(children);
    originalChildren.forEach((child, index) => {
      expect(children[index]).toBe(child);
      expect(child.parent).toBe(parent);
    });
    expect(source[0]).toBe(parent);
    expect(source[1]).toBe(sibling);
    expect(children.map(record => record.get('rank'))).toEqual([4, 3]);

    dataSet.getField('rank').order = undefined;
    await dataSet.sort('rank');
    expect(dataSet.treeData[0]).toBe(sibling);
    expect(dataSet.treeData[1]).toBe(parent);
    expect(parent.children[0]).toBe(originalChildren[1]);
    expect(parent.children[1]).toBe(originalChildren[0]);
    expect(children.map(record => record.get('rank'))).toEqual([4, 3]);
    expect(source[0]).toBe(parent);
    expect(source[1]).toBe(sibling);
  });

  it('sorts borrowed record arrays in a derivation without changing their order', () => {
    const dataSet = new DataSet({ paging: false, fields: [{ name: 'id' }], data: [{ id: 2 }, { id: 1 }] });
    dataSet.getField('id').order = 'asc';
    const source = dataSet.records;
    const result = computed(() => sortTree(source, [dataSet.getField('id')]), { keepAlive: true }).get();
    expect(result.map(record => record.get('id'))).toEqual([1, 2]);
    expect(source.map(record => record.get('id'))).toEqual([2, 1]);
    expect(result[0]).toBe(source[1]);
  });

  it('preserves explicit dataset sorting and reversing with nested records', async () => {
    const dataSet = new DataSet({
      paging: false,
      childrenField: 'children',
      fields: [{ name: 'id' }],
      data: [{ id: 2, children: [{ id: 4 }, { id: 3 }] }, { id: 1 }],
    });
    const parent = dataSet.get(0);
    await dataSet.sort('id');
    expect(dataSet.treeData.map(record => record.get('id'))).toEqual([1, 2]);
    expect(parent.children.map(record => record.get('id'))).toEqual([3, 4]);
    const before = dataSet.records.slice();
    expect(dataSet.reverse()).toEqual(before.slice().reverse());
    expect(dataSet.records.slice()).toEqual(before.slice().reverse());
  });
});
