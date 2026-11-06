import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { runInAction } from 'mobx';
import Table from '../Table';
import Column from '../Column';
import DataSet from '../../data-set';

describe('TableStore grouping inputs', () => {
  it.each(['header', 'multi', 'hidden', 'mixed'])('S01 keeps %s Group, generated columns and DOM in sync across consecutive edits', mode => {
    const ds = new DataSet({ paging: false, data: [{ category: 'A', detail: 'leaf', region: 'east', kind: 'item', amount: 17 }] });
    const groups = [{ name: 'category', type: 'header', hidden: mode === 'hidden' }];
    if (mode === 'multi') groups.push({ name: 'detail', type: 'header' });
    if (mode === 'mixed') groups.push({ name: 'region', type: 'row' }, { name: 'kind', type: 'column' });
    const columns = [{ name: 'amount', header: 'Amount', width: 123, renderer: ({ value }) => `value:${value}` }];
    const wrapper = mount(<Table dataSet={ds} groups={groups} columns={columns} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    const dispose = store.groupReaction;
    try {
      ['A', 'B', 'C'].forEach(value => {
        act(() => ds.current.set('category', value));
        wrapper.update();
        expect(store.groupedDataWithHeader.map(group => group.value)).toEqual([value]);
        expect(store.originalColumns.map(column => column.key)).toEqual([mode === 'hidden' ? `${value}-amount` : value]);
        expect(store.originalColumns[0].__group.value).toBe(value);
        if (mode !== 'hidden') expect(wrapper.find('thead').text()).toContain(value);
        if (mode === 'multi') expect(wrapper.find('thead').text()).toContain('leaf');
        expect(wrapper.find('tbody').text()).toContain('value:17');
        const leaf = mode === 'hidden' ? store.originalColumns[0] : mode === 'multi' ? store.originalColumns[0].children[0].children[0] : store.originalColumns[0].children[0];
        expect(leaf.width).toBe(123);
        expect(leaf.renderer).toBe(columns[0].renderer);
        expect(store.groupReaction).toBe(dispose);
      });
      if (mode === 'mixed') {
        act(() => ds.current.set('region', 'west'));
        act(() => ds.current.set('kind', 'changed'));
        wrapper.update();
        expect(store.groupedData[0].value).toBe('west');
        expect(store.groupedData[0].subGroups[0].value).toBe('changed');
        expect(wrapper.find('tbody').text()).toContain('west');
        expect(wrapper.find('tbody').text()).toContain('changed');
        expect(wrapper.find('tbody').text()).toContain('value:17');
      }
    } finally { wrapper.unmount(); }
  });

  it('S01 refreshes header membership, filtering and DataSet replacement with stable group and column props', () => {
    const ds = new DataSet({ paging: false });
    const groups = [{ name: 'category', type: 'header' }];
    const columns = [{ name: 'amount' }];
    const wrapper = mount(<Table dataSet={ds} groups={groups} columns={columns} filter={record => record.get('visible') !== false} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    const check = values => {
      wrapper.update();
      expect(store.groupedDataWithHeader.map(group => group.value)).toEqual(values);
      expect(store.originalColumns.map(column => column.key)).toEqual(values);
      values.forEach(value => expect(wrapper.find('thead').text()).toContain(value));
    };
    try {
      check([]);
      act(() => ds.loadData([{ category: 'A', amount: 11 }]));
      check(['A']);
      act(() => ds.create({ category: 'B', amount: 22 }));
      check(['A', 'B']);
      act(() => ds.get(0).set('visible', false));
      check(['B']);
      expect(wrapper.find('thead').text()).not.toContain('A');
      act(() => ds.remove(ds.find(record => record.get('category') === 'B')));
      check([]);
      const next = new DataSet({ paging: false, data: [{ category: 'next', amount: 33 }] });
      act(() => wrapper.setProps({ dataSet: next }));
      check(['next']);
      act(() => ds.loadData([{ category: 'detached', amount: 44 }]));
      check(['next']);
      act(() => next.current.set('category', 'active'));
      check(['active']);
      expect(wrapper.find('thead').text()).not.toContain('next');
      expect(wrapper.find('tbody').text()).toContain('33');
      expect(store.props.groups).toBe(groups);
      expect(store.props.columns).toBe(columns);
    } finally { wrapper.unmount(); }
  });

  it.each(['header', 'row', 'none'])('S01 avoids column rebuilds for unrelated edits in %s tables', type => {
    const ds = new DataSet({ paging: false, data: [{ category: 'A', amount: 17 }] });
    const groups = type === 'none' ? [] : [{ name: 'category', type }];
    const wrapper = mount(<Table dataSet={ds} groups={groups} columns={[{ name: 'amount' }]} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    const initColumns = jest.spyOn(store, 'initColumns');
    const columns = store.originalColumns;
    try {
      act(() => ds.current.set('amount', 29));
      wrapper.update();
      expect(wrapper.find('tbody').text()).toContain('29');
      if (type !== 'header') {
        act(() => ds.current.set('category', 'B'));
        if (type === 'row') expect(store.groupedData[0].value).toBe('B');
      }
      expect(initColumns).not.toHaveBeenCalled();
      expect(store.originalColumns).toBe(columns);
    } finally {
      initColumns.mockRestore();
      wrapper.unmount();
    }
  });

  it.each(['row', 'header', 'column'])('F02 tracks consecutive %s edits without reinstalling the reaction', type => {
    const ds = new DataSet({ paging: false, fields: [{ name: 'category' }, { name: 'other' }], data: [{ category: 'A', other: 'one' }] });
    const wrapper = mount(<Table dataSet={ds} groups={[{ name: 'category', type }]} columns={[]} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    const grouped = () => type === 'header' ? store.groupedDataWithHeader : store.groupedData;
    const dispose = store.groupReaction;
    try {
      ds.current.set('category', 'B');
      expect(grouped().map(group => group.value)).toEqual(['B']);
      ds.current.set('category', 'C');
      expect(grouped().map(group => group.value)).toEqual(['C']);
      expect(store.groupReaction).toBe(dispose);
      const previous = store.groupedData;
      ds.current.set('other', 'two');
      expect(store.groupedData).toBe(previous);
      runInAction(() => { grouped()[0].isExpanded = false; });
      ds.create({ category: 'C' });
      expect(grouped()[0].isExpanded).toBe(false);
      ds.remove(ds.get(1));
      expect(grouped()[0].value).toBe('C');
      ds.current.reset();
      expect(grouped().map(group => group.value)).toEqual(['A']);
    } finally { wrapper.unmount(); }
  });
  it('F02 tracks multiple levels, parentField and filtered membership', () => {
    const ds = new DataSet({ paging: false, data: [
      { category: 'A', parent: null, detail: 'one', visible: true },
      { category: 'B', parent: 'A', detail: 'two', visible: true },
    ] });
    const wrapper = mount(<Table dataSet={ds} groups={[{ name: 'category', type: 'row', parentField: 'parent' }, { name: 'detail', type: 'column' }]} filter={record => record.get('visible')} columns={[]} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    try {
      ds.get(0).set('detail', 'changed');
      ds.get(0).set('detail', 'again');
      expect(store.groupedData[0].subGroups[0].value).toBe('again');
      ds.get(1).set('parent', null);
      expect(store.groupedData.map(group => group.value)).toEqual(['A', 'B']);
      ds.get(1).set('parent', 'A');
      expect(store.groupedData.map(group => group.value)).toEqual(['A']);
      ds.get(1).set('visible', false);
      expect(store.currentData).toHaveLength(1);
      expect(store.groupedDataWithHeader.map(group => group.value)).toEqual(['A']);
      ds.loadData([{ category: 'loaded', detail: 'leaf', visible: true }]);
      expect(store.groupedData[0].value).toBe('loaded');
    } finally { wrapper.unmount(); }
  });

  it('H01 supports column replacement through props for all lock partitions', () => {
    const wrapper = mount(<Table dataSet={new DataSet()} columns={[]} queryBar="none" pagination={false} />);
    const store = wrapper.instance().tableStore;
    try {
      wrapper.setProps({ columns: [
        { name: 'left', lock: 'left', renderer: Column },
        { name: 'middle', renderer: Column },
        { name: 'right', lock: 'right', renderer: Column },
      ] });
      [store.leftOriginalColumns, store.originalColumns, store.rightOriginalColumns].forEach(columns => {
        expect(columns[0].renderer).toBe(Column);
        expect(columns[0].renderer.__PRO_TABLE_COLUMN).toBe(true);
      });
    } finally { wrapper.unmount(); }
  });
});
