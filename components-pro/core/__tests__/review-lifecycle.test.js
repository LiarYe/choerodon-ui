import React from 'react';
import { mount } from 'enzyme';
import { runInAction } from 'mobx';
import TextField from '../../text-field';
import Cascader from '../../cascader';
import DataSet from '../../data-set';
import TableDynamicFilterBar from '../../table/query-bar/TableDynamicFilterBar';
import FormContext from '../../form/FormContext';

describe('review lifecycle regressions', () => {
  it('updates rendered prefixes for context, suffix and removed custom props in the same update', () => {
    const context = FormContext._currentValue;
    const makeContext = prefix => ({ ...context, getProPrefixCls: (suffix, custom) => custom || `${prefix}-${suffix}` });
    const field = <TextField suffixCls="field" />;
    const wrapper = mount(<FormContext.Provider value={makeContext('first')}>{field}</FormContext.Provider>);
    try {
      expect(wrapper.find('input').hasClass('first-field')).toBe(true);
      wrapper.setProps({ value: makeContext('second') });
      expect(wrapper.find('input').hasClass('second-field')).toBe(true);
      wrapper.setProps({ children: React.cloneElement(field, { prefixCls: 'custom' }) });
      expect(wrapper.find('input').hasClass('custom')).toBe(true);
      wrapper.setProps({ value: makeContext('third'), children: field });
      expect(wrapper.find('input').hasClass('third-field')).toBe(true);
      wrapper.setProps({ children: React.cloneElement(field, { suffixCls: 'changed' }) });
      expect(wrapper.find('input').hasClass('third-changed')).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it('runs mounted debounced search but cancels pending remote and local search on unmount', async () => {
    const wrapper = mount(<Cascader searchable searchMatcher="name" />);
    const instance = wrapper.instance();
    const remote = jest.spyOn(instance, 'searchRemote').mockImplementation(() => {});
    const local = jest.spyOn(instance, 'handleSearch');
    try {
      wrapper.find('input').last().simulate('change', { target: { value: 'first' } });
      await new Promise(resolve => { setTimeout(resolve, 600); });
      expect(remote).toHaveBeenCalledWith('first');
      expect(local).toHaveBeenCalledWith('first');
      remote.mockClear();
      local.mockClear();
      wrapper.find('input').last().simulate('change', { target: { value: 'pending' } });
      wrapper.unmount();
      await new Promise(resolve => { setTimeout(resolve, 600); });
      expect(remote).not.toHaveBeenCalled();
      expect(local).not.toHaveBeenCalled();
      expect(instance.checkValueReaction).toBeUndefined();
    } finally {
      if (wrapper.exists()) wrapper.unmount();
      remote.mockRestore();
      local.mockRestore();
    }
  });

  it.each([false, true])('removes filter listeners and disposes autorun when visible=%s', visible => {
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');
    const wrapper = mount(<TableDynamicFilterBar dataSet={new DataSet()} queryFields={[]} fuzzyQueryOnly />);
    const instance = wrapper.instance();
    const handler = instance.handleEmitFilterCancel;
    try {
      runInAction(() => { instance.visible = true; });
      expect(add).toHaveBeenCalledWith('mousedown', handler);
      expect(add).toHaveBeenCalledWith('keydown', handler);
      runInAction(() => { instance.visible = visible; });
      wrapper.unmount();
      expect(remove).toHaveBeenCalledWith('mousedown', handler);
      expect(remove).toHaveBeenCalledWith('keydown', handler);
      expect(instance.filterVisibleDisposer).toBeUndefined();
      add.mockClear();
      remove.mockClear();
      runInAction(() => { instance.visible = !visible; });
      runInAction(() => { instance.visible = visible; });
      expect(add.mock.calls.filter(call => call[1] === handler)).toHaveLength(0);
      expect(remove.mock.calls.filter(call => call[1] === handler)).toHaveLength(0);
    } finally {
      if (wrapper.exists()) wrapper.unmount();
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
