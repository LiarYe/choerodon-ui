import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import PerformanceTable from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';

describe('PerformanceTable selection and customization', () => {
  it('retains the selection column after asynchronous customization loads', async () => {
    let resolveLoad;
    const load = jest.fn(() => new Promise(resolve => { resolveLoad = resolve; }));
    const context = ConfigContext._currentValue;
    const value = { ...context, getConfig: key => key === 'tableCustomizedLoad' ? load : context.getConfig(key) };
    const columns = Object.freeze([{ key: 'name', dataIndex: 'name', title: 'Name', width: 100 }]);
    const wrapper = mount(
      <ConfigContext.Provider value={value}>
        <PerformanceTable columns={columns} data={[{ key: '1', name: 'First' }]} rowSelection={{}} customizedCode="selection" customizable queryBar={false} width={500} height={300} virtualized={false} />
      </ConfigContext.Provider>,
    );
    try {
      const instance = wrapper.find(PerformanceTable).instance();
      expect(instance.tableStore.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name']);
      expect(instance.tableStore.originalColumns.find(column => column.key === 'name').width).toBe(100);
      expect(wrapper.find('input[type="checkbox"]').length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('First');
      await act(async () => {
        resolveLoad({ columns: { name: { width: 140 } } });
        await Promise.resolve();
      });
      wrapper.update();
      expect(instance.tableStore.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name']);
      expect(instance.tableStore.originalColumns.find(column => column.key === 'name').width).toBe(140);
      expect(wrapper.find('input[type="checkbox"]').length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('First');
      expect(columns.map(column => column.key)).toEqual(['name']);
    } finally {
      wrapper.unmount();
    }
  });

  it('removes selection columns and checkboxes with stable caller columns', () => {
    const columns = Object.freeze([{ key: 'name', dataIndex: 'name', title: 'Name', width: 100 }]);
    const wrapper = mount(<PerformanceTable columns={columns} data={[{ key: '1', name: 'First' }]} rowSelection={{}} queryBar={false} width={500} height={300} virtualized={false} />);
    try {
      expect(wrapper.instance().tableStore.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name']);
      expect(wrapper.find('input[type="checkbox"]').length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('First');
      wrapper.setProps({ rowSelection: undefined });
      expect(wrapper.instance().tableStore.originalColumns.map(column => column.key)).toEqual(['name']);
      expect(wrapper.find('input[type="checkbox"]')).toHaveLength(0);
      expect(wrapper.text()).toContain('First');
      expect(columns.map(column => column.key)).toEqual(['name']);
    } finally {
      wrapper.unmount();
    }
  });
});
