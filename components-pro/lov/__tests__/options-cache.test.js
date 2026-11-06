import React from 'react';
import { mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import format from 'pretty-format';
import { autorun, observable, onBecomeUnobserved, runInAction } from 'mobx';
import Lov from '..';
import DataSet from '../../data-set';
import lovCodeStore from '../../../components-dataset/stores/LovCodeStore';

it('keeps record option caches private and fully serializes a mounted Lov', () => {
  const ds = new DataSet({
    autoCreate: true,
    fields: [
      { name: 'code', textField: 'code', type: 'object', lovCode: 'LOV_CODE', lovPara: { code: '111' }, required: true },
      { name: 'code_code', type: 'string', bind: 'code.code' },
      { name: 'code_description', type: 'string', bind: 'code.description' },
    ],
  });
  const wrapper = mount(<Lov dataSet={ds} name="code" mode="button" />);
  try {
    expect(wrapper.find('button')).toHaveLength(2);
    expect(ds.length).toBe(1);
    expect(ds.current).not.toHaveProperty('computedFieldOptions');
    const serialized = format(toJson(wrapper), {
      plugins: [format.plugins.ReactTestComponent, format.plugins.ReactElement, format.plugins.DOMElement, format.plugins.DOMCollection],
    });
    expect(serialized).toContain('LOV_CODE');
    expect(serialized).toContain('code_description');
    expect(serialized).not.toContain('observing_');
  } finally {
    wrapper.unmount();
  }
});

it('releases computed dependencies after disposal and recomputes on observation', () => {
  const ds = new DataSet({ data: [{ code: 'a' }], fields: [{ name: 'code', type: 'object', lovCode: 'CACHE_TEST' }] });
  const first = new DataSet({ paging: false });
  const second = new DataSet({ paging: false });
  const source = observable.box(first, { deep: false });
  const unobserved = jest.fn();
  const stop = onBecomeUnobserved(source, unobserved);
  const getLovDataSet = jest.spyOn(lovCodeStore, 'getLovDataSet').mockImplementation(() => source.get());
  const field = ds.getField('code');
  let options;
  let dispose = autorun(() => { options = field.getOptions(ds.current); });
  try {
    expect(options).toBe(first);
    dispose();
    expect(unobserved).toHaveBeenCalledTimes(1);
    getLovDataSet.mockClear();
    runInAction(() => source.set(second));
    expect(getLovDataSet).not.toHaveBeenCalled();
    dispose = autorun(() => { options = field.getOptions(ds.current); });
    expect(options).toBe(second);
  } finally {
    dispose();
    stop();
    getLovDataSet.mockRestore();
  }
});

it('preserves record-scoped option cache identity and reactive invalidation', () => {
  const first = new DataSet({ paging: false });
  const second = new DataSet({ paging: false });
  const ds = new DataSet({
    data: [{ code: 'a' }, { code: 'b' }],
    fields: [{ name: 'code', type: 'object', lovCode: 'CACHE_TEST' }],
  });
  const getLovDataSet = jest.spyOn(lovCodeStore, 'getLovDataSet').mockImplementation((code, field, props, record) => (
    record === ds.get(0) ? first : second
  ));
  const field = ds.getField('code');
  const record = ds.get(0);
  let options;
  const dispose = autorun(() => { options = field.getOptions(record); });
  try {
    expect(options).toBeDefined();
    const calls = getLovDataSet.mock.calls.length;
    expect(field.getOptions(record)).toBe(options);
    expect(getLovDataSet).toHaveBeenCalledTimes(calls);
    expect(field.getOptions(ds.get(1))).not.toBe(options);
    field.set('options', first);
    expect(options).toBe(first);
    field.set('options', second);
    expect(options).toBe(second);
    expect(record).not.toHaveProperty('computedFieldOptions');
  } finally {
    dispose();
    getLovDataSet.mockRestore();
  }
});
