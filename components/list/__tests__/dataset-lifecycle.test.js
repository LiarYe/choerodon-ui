import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import DataSet from 'choerodon-ui/dataset';
import List from '..';

describe('List DataSet lifecycle', () => {
  it('initializes checked records before the first item render', () => {
    const dataSet = new DataSet({
      checkField: 'checked',
      fields: [{ name: 'checked', type: 'boolean' }],
      data: [{ checked: true }],
    });
    const renderItem = jest.fn(({ record }) => <List.Item>{String(record.isSelected)}</List.Item>);
    const wrapper = mount(<List dataSet={dataSet} renderItem={renderItem} />);
    try {
      expect(renderItem.mock.results[0].value.props.children).toBe('true');
    } finally {
      wrapper.unmount();
    }
  });

  it('defaults omitted listener arguments without falling back for explicit undefined', () => {
    const dataSet = new DataSet();
    const wrapper = mount(<List dataSet={dataSet} renderItem={() => <List.Item />} />);
    const add = jest.spyOn(dataSet, 'addEventListener');
    const remove = jest.spyOn(dataSet, 'removeEventListener');
    const instance = wrapper.instance();
    try {
      instance.processDataSetListener(false);
      expect(remove).toHaveBeenCalledWith('load', instance.handleDataSetLoad);
      instance.processDataSetListener(true);
      expect(add).toHaveBeenCalledWith('load', instance.handleDataSetLoad);
      add.mockClear();
      remove.mockClear();
      instance.processDataSetListener(false, undefined);
      instance.processDataSetListener(true, undefined);
      expect(remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      jest.restoreAllMocks();
    }
  });

  it('moves load listeners and initializes selection on replacement, removal and unmount', () => {
    const createDataSet = () => new DataSet({
      checkField: 'checked',
      fields: [{ name: 'checked', type: 'boolean' }],
      data: [{ checked: true }],
    });
    const first = createDataSet();
    const second = createDataSet();
    const firstAdd = jest.spyOn(first, 'addEventListener');
    const firstRemove = jest.spyOn(first, 'removeEventListener');
    const secondAdd = jest.spyOn(second, 'addEventListener');
    const secondRemove = jest.spyOn(second, 'removeEventListener');
    const wrapper = mount(<List dataSet={first} renderItem={() => <List.Item />} />);
    const initialize = jest.spyOn(wrapper.instance(), 'initDefaultCheckRows');
    const handler = firstAdd.mock.calls.find(([event]) => event === 'load')[1];
    try {
      expect(first.get(0).isSelected).toBe(true);
      act(() => { wrapper.setProps({ dataSet: second }); });
      expect(firstRemove).toHaveBeenCalledWith('load', handler);
      expect(secondAdd).toHaveBeenCalledWith('load', handler);
      expect(second.get(0).isSelected).toBe(true);
      initialize.mockClear();
      act(() => { first.loadData([{ checked: true }]); });
      expect(initialize).not.toHaveBeenCalled();
      act(() => { second.loadData([{ checked: true }]); });
      expect(initialize).toHaveBeenCalledTimes(1);
      expect(second.get(0).isSelected).toBe(true);
      secondAdd.mockClear();
      act(() => { wrapper.setProps({ header: 'updated' }); });
      expect(secondAdd).not.toHaveBeenCalled();
      act(() => { wrapper.setProps({ dataSet: undefined }); });
      expect(secondRemove).toHaveBeenCalledWith('load', handler);
      initialize.mockClear();
      act(() => { second.loadData([{ checked: true }]); });
      expect(initialize).not.toHaveBeenCalled();
      act(() => { wrapper.setProps({ dataSet: first }); });
      expect(first.get(0).isSelected).toBe(true);
    } finally {
      wrapper.unmount();
    }
    initialize.mockClear();
    act(() => {
      first.loadData([{ checked: true }]);
      second.loadData([{ checked: true }]);
    });
    expect(initialize).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
