import React from 'react';
import { mount } from 'enzyme';
import FilterSelect from '../query-bar/FilterSelect';
import DataSet from '../../data-set';
import FormContext from '../../form/FormContext';

describe('FilterSelect subscription lifecycle', () => {
  const createDataSet = () => new DataSet({ fields: [{ name: 'name', type: 'string' }], data: [{}] });
  const listeners = (dataSet, event, handler) => (dataSet.events[event] || []).filter(([fn]) => fn === handler);

  it('does not attach DataSet listeners or a reaction in the constructor', () => {
    const queryDataSet = createDataSet();
    const instance = new FilterSelect({ ...FilterSelect.defaultProps, queryDataSet, optionDataSet: new DataSet() }, FormContext._currentValue);
    expect(instance.reaction).toBeUndefined();
    expect(instance.queryDataSet).toBeUndefined();
    expect(listeners(queryDataSet, 'update', instance.handleDataSetUpdate)).toHaveLength(0);
    expect(listeners(queryDataSet, 'reset', instance.handleDataSetReset)).toHaveLength(0);
  });

  it('binds once, switches and removes queryDataSet props, and cleans up on unmount', async () => {
    const first = createDataSet();
    const next = createDataSet();
    const optionDataSet = new DataSet();
    const query = jest.spyOn(optionDataSet, 'query').mockResolvedValue(undefined);
    const onReset = jest.fn();
    const wrapper = mount(<FilterSelect queryDataSet={first} optionDataSet={optionDataSet} onReset={onReset} />);
    const instance = wrapper.instance();
    const expectListeners = (dataSet, count) => {
      expect(listeners(dataSet, 'update', instance.handleDataSetUpdate)).toHaveLength(count);
      expect(listeners(dataSet, 'reset', instance.handleDataSetReset)).toHaveLength(count);
    };
    try {
      expectListeners(first, 1);
      first.current.set('name', 'first');
      await Promise.resolve();
      expect(query).toHaveBeenCalledTimes(1);
      expect(instance.getValues()).toEqual(['name']);
      wrapper.setProps({ queryDataSet: next });
      expectListeners(first, 0);
      expectListeners(next, 1);
      wrapper.setProps({ className: 'updated' });
      expectListeners(next, 1);
      query.mockClear();
      first.current.set('name', 'detached');
      first.current.reset();
      await Promise.resolve();
      expect(query).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
      next.current.set('name', 'next');
      next.current.reset();
      expect(onReset).toHaveBeenCalledTimes(1);
      wrapper.setProps({ queryDataSet: undefined });
      expectListeners(next, 0);
      expect(instance.queryDataSet).toBeUndefined();
      wrapper.setProps({ queryDataSet: first });
      expectListeners(first, 1);
      instance.setText('pending filter');
      instance.doQuery();
      wrapper.unmount();
      expectListeners(first, 0);
      expectListeners(next, 0);
      expect(instance.reaction).toBeUndefined();
      expect(instance.queryDataSet).toBeUndefined();
      await Promise.resolve();
      query.mockClear();
      onReset.mockClear();
      first.current.set('name', 'after unmount');
      next.current.reset();
      await new Promise(resolve => { setTimeout(resolve, 600); });
      expect(query).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
      expect(instance.filterText).toBeUndefined();
    } finally {
      if (wrapper.exists()) wrapper.unmount();
      query.mockRestore();
    }
  });
});
