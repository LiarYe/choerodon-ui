import React from 'react';
import { mount } from 'enzyme';
import PerformanceTable from '../Table';

describe('PerformanceTable column updates', () => {
  it.each([0, 1])('retains columns and inserts one selection column at %s without changing props', columnIndex => {
    const columns = Object.freeze([
      { key: 'name', dataKey: 'name', title: 'Name', width: 100 },
      { key: 'age', dataKey: 'age', title: 'Age', width: 100 },
    ]);
    const wrapper = mount(<PerformanceTable columns={[]} data={[]} rowSelection={{ columnIndex }} queryBar={false} width={500} height={300} virtualized={false} />);
    try {
      wrapper.setProps({ columns });
      const expected = ['name', 'age'];
      expected.splice(columnIndex, 0, 'rowSelection');
      expect(wrapper.instance().tableStore.originalColumns.map(column => column.key)).toEqual(['rowSelection', 'name', 'age']);
      expect(wrapper.instance().state.shouldFixedColumn).toBe(true);
      expect(wrapper.text()).toContain('Name');
      expect(wrapper.text()).toContain('Age');
      wrapper.setProps({ rowSelection: { columnIndex, fixed: false } });
      expect(wrapper.instance().tableStore.originalColumns.map(column => column.key)).toEqual(expected);
      expect(columns.map(column => column.key)).toEqual(['name', 'age']);
      expect(wrapper.instance().props.columns).toBe(columns);
    } finally {
      wrapper.unmount();
    }
  });
});
