import React from 'react';
import { mount } from 'enzyme';
import Cascader from '..';
import DataSet from '../../data-set';

describe('Cascader host DOM', () => {
  let wrapper;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function createOptions() {
    return new DataSet({
      data: [{ id: 7, parentId: 2, text: '员工管理(react)' }, { id: 2, text: '组织架构' }],
      parentField: 'parentId',
      idField: 'id',
      fields: [{ name: 'id', type: 'string' }, { name: 'parentId', type: 'string' }],
    });
  }

  it('keeps an unrelated field empty without changing the configured path', () => {
    const options = createOptions();
    const dataSet = new DataSet({
      autoCreate: true,
      fields: [{ name: 'id', type: 'string', textField: 'text', valueField: 'id', defaultValue: ['2', '7'], options }],
    });
    const before = dataSet.current.toData();
    wrapper = mount(<Cascader dataSet={dataSet} name="user" />);
    jest.runAllTimers();
    const host = wrapper.getDOMNode();
    expect(host.querySelector('input[type="text"]').value).toBe('');
    expect(host.querySelector('input[type="text"]').readOnly).toBe(true);
    expect(host.querySelector('input[type="hidden"]').name).toBe('user');
    expect(dataSet.current.get('user')).toBeUndefined();
    expect(dataSet.current.get('id')).toEqual(['2', '7']);
    expect(dataSet.current.toData()).toEqual(before);
    expect(options.records.map(record => record.get('id'))).toEqual(['7', '2']);
  });

  it('preserves option records when the legacy detached input click settles', () => {
    const dataSet = createOptions();
    const before = dataSet.records.map(record => record.toData());
    wrapper = mount(<Cascader dataSet={dataSet} name="user" />);
    wrapper.find('input.c7n-pro-cascader').simulate('click');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.getDOMNode().querySelector('input[type="text"]').value).toBe('');
    expect(wrapper.getDOMNode().querySelectorAll('input')).toHaveLength(2);
    expect(wrapper.instance().popup).toBe(false);
    expect(dataSet.records.map(record => record.toData())).toEqual(before);
  });
});
