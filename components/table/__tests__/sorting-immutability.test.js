import React from 'react';
import { mount } from 'enzyme';
import 'intersection-observer';
import Table from '..';

describe('Table sorting immutability', () => {
  it.each(['children', 'nodes'])('sorts every %s level without mutating input', childrenColumnName => {
    const grandchildren = Object.freeze([{ key: 'g2', value: 2 }, { key: 'g1', value: 1 }]);
    const children = Object.freeze([
      Object.freeze({ key: 'c2', value: 2, [childrenColumnName]: grandchildren }),
      { key: 'c1', value: 1 },
    ]);
    const dataSource = Object.freeze([
      Object.freeze({ key: 'r2', value: 2, [childrenColumnName]: children }),
      { key: 'r1', value: 1 },
    ]);
    const column = { title: 'Value', dataIndex: 'value', sorter: (a, b) => a.value - b.value };
    const wrapper = mount(<Table dataSource={dataSource} childrenColumnName={childrenColumnName} columns={[column]} pagination={false} />);
    try {
      ['ascend', 'descend', null].forEach(sortOrder => {
        wrapper.setProps({ columns: [{ ...column, sortOrder }] });
        const result = wrapper.instance().getLocalData();
        const expected = sortOrder === 'ascend' ? [1, 2] : [2, 1];
        expect(result.map(item => item.value)).toEqual(expected);
        const sortedChildren = result.find(item => item.key === 'r2')[childrenColumnName];
        expect(sortedChildren.map(item => item.value)).toEqual(expected);
        expect(sortedChildren.find(item => item.key === 'c2')[childrenColumnName].map(item => item.value)).toEqual(expected);
        expect(dataSource.map(item => item.value)).toEqual([2, 1]);
        expect(children.map(item => item.value)).toEqual([2, 1]);
        expect(grandchildren.map(item => item.value)).toEqual([2, 1]);
        expect(dataSource[0][childrenColumnName]).toBe(children);
        expect(children[0][childrenColumnName]).toBe(grandchildren);
      });
    } finally {
      wrapper.unmount();
    }
  });
});
