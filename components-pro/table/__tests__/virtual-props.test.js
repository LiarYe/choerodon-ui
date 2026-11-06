import React from 'react';
import { mount } from 'enzyme';
import { Droppable } from 'react-beautiful-dnd';
import { autorun } from 'mobx';
import { act } from 'react-dom/test-utils';
import Table from '../Table';
import VirtualWrapper from '../VirtualWrapper';
import DataSet from '../../data-set';

describe('Table cross-instance reactive props', () => {
  it.each([true, false])('mounts draggable rows with virtual=%s and updates their droppable id', virtual => {
    const dataSet = new DataSet({
      paging: false,
      fields: [{ name: 'name', type: 'string' }],
      data: [{ name: 'first' }, { name: 'second' }],
    });
    const wrapper = mount(
      <Table
        id="first-table"
        dataSet={dataSet}
        columns={[{ name: 'name' }]}
        virtual={virtual}
        rowDraggable
        style={{ height: 300 }}
        queryBar="none"
        pagination={false}
      />,
    );
    try {
      expect(wrapper.find(VirtualWrapper).length).toBe(virtual ? 1 : 0);
      expect(wrapper.find(Droppable).prop('droppableId')).toBe('first-table');
      expect(wrapper.text()).toContain('first');
      wrapper.setProps({ id: 'next-table', rowHeight: 40 });
      expect(wrapper.find(Droppable).prop('droppableId')).toBe('next-table');
      expect(wrapper.instance().tableStore.rowHeight).toBe(40);
      wrapper.setProps({ id: undefined });
      expect(wrapper.find(Droppable).prop('droppableId')).toBe('table');
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps virtual render callbacks reactive when dataSet and rendering props change', () => {
    const first = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'first' }] });
    const next = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'next' }] });
    const wrapper = mount(<Table dataSet={first} columns={[{ name: 'name' }]} virtual style={{ height: 300 }} queryBar="none" pagination={false} />);
    const values = [];
    const dispose = autorun(() => values.push(wrapper.instance().tableStore.props.id));
    try {
      expect(wrapper.find(VirtualWrapper)).toHaveLength(1);
      expect(wrapper.text()).toContain('first');
      wrapper.setProps({ dataSet: next, id: 'updated', rowHeight: 45 });
      expect(wrapper.text()).toContain('next');
      expect(wrapper.text()).not.toContain('first');
      expect(values).toEqual([undefined, 'updated']);
      expect(wrapper.instance().tableStore.rowHeight).toBe(45);
    } finally {
      dispose();
      wrapper.unmount();
    }
  });

  it('updates the mounted virtual row window from scroll events after props change', async () => {
    const createDataSet = prefix => new DataSet({
      paging: false,
      fields: [{ name: 'name', type: 'string' }],
      data: Array.from({ length: 60 }, (_, index) => ({ name: `${prefix}-${index}` })),
    });
    const first = createDataSet('first');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onScrollTop = jest.fn();
    const wrapper = mount(
      <Table
        dataSet={first}
        columns={[{ name: 'name' }]}
        virtual
        style={{ height: 120 }}
        queryBar="none"
        pagination={false}
      />,
      { attachTo: host },
    );
    try {
      const table = wrapper.instance();
      const tableStore = table.tableStore;
      const scrollNode = table.tableBodyWrap;
      Object.defineProperty(scrollNode, 'clientHeight', { configurable: true, value: 120 });
      expect(tableStore.overflowY).toBe(true);
      expect(wrapper.text()).toContain('first-0');
      expect(wrapper.text()).not.toContain('first-30');

      scrollNode.scrollTop = tableStore.virtualRowHeight * 30;
      await act(async () => {
        scrollNode.dispatchEvent(new Event('scroll', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
      });
      wrapper.update();
      expect(tableStore.lastScrollTop).toBe(scrollNode.scrollTop);
      expect(tableStore.virtualVisibleStartIndex).toBe(30);
      expect(wrapper.text()).toContain('first-30');
      expect(wrapper.text()).not.toContain('first-0');

      const next = createDataSet('next');
      wrapper.setProps({ dataSet: next, rowHeight: 42, onScrollTop });
      expect(tableStore.rowHeight).toBe(42);
      expect(wrapper.text()).toContain('next-');
      expect(wrapper.text()).not.toContain('first-');

      scrollNode.scrollTop = tableStore.virtualRowHeight * 45;
      await act(async () => {
        scrollNode.dispatchEvent(new Event('scroll', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 30));
      });
      wrapper.update();
      expect(tableStore.lastScrollTop).toBe(scrollNode.scrollTop);
      expect(tableStore.virtualVisibleStartIndex).toBe(45);
      expect(wrapper.text()).toContain('next-45');
      expect(wrapper.text()).not.toContain('next-0');
      expect(onScrollTop).toHaveBeenCalledWith(scrollNode.scrollTop, expect.any(Function));
    } finally {
      wrapper.unmount();
      host.remove();
    }
  });
});
