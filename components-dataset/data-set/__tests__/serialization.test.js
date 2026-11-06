import { autorun, computed } from 'mobx';
import DataSet from '../DataSet';
import * as utils from '../../utils';

describe('DataSet and Record serialization diagnostics', () => {
  let warning;

  beforeEach(() => {
    warning = jest.spyOn(utils, 'warning');
  });

  afterEach(() => {
    warning.mockRestore();
  });

  it.each(['direct', 'computed', 'autorun'])('preserves serialization in %s context without rendering warnings', context => {
    const dataSet = new DataSet({
      fields: [{ name: 'id', type: 'number' }, { name: 'name' }],
      data: [{ id: 1, name: 'before' }],
    });
    const record = dataSet.get(0);
    const serialize = () => ({
      data: dataSet.toData(),
      json: dataSet.toJSONData(),
      record: record.toData(),
    });
    const values = [];
    let dispose;
    const derived = computed(serialize);
    const capture = () => values.push(context === 'computed' ? derived.get() : serialize());
    try {
      if (context === 'direct') {
        capture();
      } else {
        dispose = autorun(capture);
      }
      record.set('name', 'after');
      if (context === 'direct') {
        capture();
      }
      expect(values).toEqual([
        {
          data: [{ id: 1, name: 'before' }],
          json: [],
          record: { id: 1, name: 'before', __dirty: false },
        },
        {
          data: [{ id: 1, name: 'after' }],
          json: [{ id: 1, name: 'after', __id: record.id, __status: 'update' }],
          record: { id: 1, name: 'after', __dirty: true },
        },
      ]);
      expect(warning).not.toHaveBeenCalled();
    } finally {
      if (dispose) {
        dispose();
      }
    }
  });

  it('preserves selected serialization and cascade options', () => {
    const child = new DataSet({ fields: [{ name: 'value' }], dataToJSON: 'all' });
    const dataSet = new DataSet({
      children: { details: child },
      dataToJSON: 'selected',
      data: [{ id: 1, details: [{ value: 'child' }] }, { id: 2 }],
    });
    const record = dataSet.get(0);
    dataSet.select(record);
    child.get(0).set('value', 'changed');
    const json = dataSet.toJSONData();
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: 1, details: [{ value: 'changed', __status: 'update' }] });
    expect(record.toData()).toEqual({ id: 1, details: [{ value: 'changed' }], __dirty: true });
    expect(record.toData(false, true)).toEqual({ id: 1, details: [{ value: 'child' }], __dirty: false });
    expect(warning).not.toHaveBeenCalled();
  });

  it('retains unrelated Record and DataSet warnings', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'value' }] });
    dataSet.get(0).getField('name');
    dataSet.bind(new DataSet());
    expect(warning).toHaveBeenCalledWith(false, expect.stringContaining('record.getField'));
    expect(warning).toHaveBeenCalledWith(false, 'DataSet: cascade binding need a name');
  });
});
