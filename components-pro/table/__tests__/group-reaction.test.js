import React from 'react';
import { mount } from 'enzyme';
import Table from '../Table';
import DataSet from '../../data-set';

describe('TableStore group reaction lifecycle', () => {
  it('tracks grouped data on mount, replacement and updates, and stops after unmount', () => {
    const createDataSet = value => new DataSet({
      paging: false,
      fields: [{ name: 'category', type: 'string' }],
      data: [{ category: value }],
    });
    const first = createDataSet('first');
    const next = createDataSet('next');
    const groups = [{ name: 'category', type: 'row' }];
    const wrapper = mount(<Table dataSet={first} groups={groups} columns={[]} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    const initGroups = jest.spyOn(store, 'initGroups');
    try {
      expect(store.groupedData.map(group => group.value)).toEqual(['first']);
      first.loadData([{ category: 'loaded' }]);
      expect(initGroups).toHaveBeenCalledTimes(1);
      expect(store.groupedData.map(group => group.value)).toEqual(['loaded']);
      wrapper.setProps({ dataSet: next });
      expect(store.groupedData.map(group => group.value)).toEqual(['next']);
      initGroups.mockClear();
      first.loadData([{ category: 'detached' }]);
      expect(initGroups).not.toHaveBeenCalled();
      next.loadData([{ category: 'active' }]);
      expect(initGroups).toHaveBeenCalledTimes(1);
      expect(store.groupedData.map(group => group.value)).toEqual(['active']);
      wrapper.setProps({ groups: [] });
      initGroups.mockClear();
      next.loadData([{ category: 'ungrouped' }]);
      expect(initGroups).not.toHaveBeenCalled();
      expect(store.groupedData).toHaveLength(0);
      wrapper.setProps({ groups });
      expect(store.groupedData.map(group => group.value)).toEqual(['ungrouped']);
      wrapper.unmount();
      initGroups.mockClear();
      next.loadData([{ category: 'after unmount' }]);
      expect(initGroups).not.toHaveBeenCalled();
    } finally {
      if (wrapper.exists()) wrapper.unmount();
      initGroups.mockRestore();
    }
  });
});
