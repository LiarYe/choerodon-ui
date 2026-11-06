import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { observable, runInAction } from 'mobx';
import Cell from '../Cell';
import TableContext from '../TableContext';
import PerformanceTable from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';
import { TableHeightType } from '../../table/enum';

describe('PerformanceTable render commits', () => {
  it('registers fixed merged cells only on commit without repeating onCell or row indices', () => {
    const store = observable({ rowZIndex: [] });
    const context = { tableStore: store };
    const onCell = jest.fn(() => ({ rowSpan: 0 }));
    const props = { fixed: true, rowData: { name: 'first' }, rowIndex: 2, onCell };
    const cell = new Cell(props, context);
    cell.render();
    cell.render();
    expect(store.rowZIndex.slice()).toEqual([]);
    onCell.mockClear();
    const wrapper = mount(<TableContext.Provider value={context}><Cell {...props} /></TableContext.Provider>);
    try {
      expect(onCell).toHaveBeenCalledTimes(1);
      expect(store.rowZIndex.slice()).toEqual([2]);
      expect(wrapper.html()).toBe('');
      wrapper.setProps({ children: <Cell {...props} rowIndex={3} /> });
      expect(store.rowZIndex.slice()).toEqual([2, 3]);
      wrapper.setProps({ children: <Cell {...props} /> });
      expect(store.rowZIndex.slice()).toEqual([2, 3]);
      wrapper.setProps({ children: <Cell {...props} rowIndex={4} fixed={false} /> });
      expect(store.rowZIndex.slice()).toEqual([2, 3]);
    } finally {
      wrapper.unmount();
    }
  });

  it('does not synchronize props or height in an uncommitted render', () => {
    const instance = new PerformanceTable({ ...PerformanceTable.defaultProps, data: [], queryBar: false, height: 300 }, ConfigContext._currentValue);
    const context = instance.tableStore.context;
    runInAction(() => { instance.tableStore.totalHeight = 123; });
    instance.context = { ...context };
    instance.render();
    expect(instance.tableStore.context).toBe(context);
    expect(instance.tableStore.totalHeight).toBe(123);
  });

  it.each([false, true])('T03 keeps customizable uncommitted height renders pure with autoHeight %s', autoHeight => {
    const context = ConfigContext._currentValue;
    const load = jest.fn(() => new Promise(() => {}));
    const value = { ...context, getConfig: key => key === 'tableCustomizedLoad' ? load : context.getConfig(key) };
    const instance = new PerformanceTable({ ...PerformanceTable.defaultProps, data: [], queryBar: false, height: 300, minHeight: 0, customizedCode: 'pure', customizable: true, autoHeight }, value);
    const state = instance.state;
    const setState = jest.spyOn(instance, 'setState');
    const forceUpdate = jest.spyOn(instance, 'forceUpdate');
    runInAction(() => {
      instance.tableStore.totalHeight = 123;
      instance.tableStore.customized = { columns: {}, heightType: TableHeightType.fixed, height: 460 };
    });
    try {
      instance.render();
      instance.render();
      expect(instance.getTableHeight()).toBe(autoHeight ? instance.getTableHeaderHeight() + 10 : 460);
      expect(setState).not.toHaveBeenCalled();
      expect(forceUpdate).not.toHaveBeenCalled();
      expect(instance.state).toBe(state);
      expect(instance.tableStore.totalHeight).toBe(123);
      expect(instance.tableStore.context).toBe(value);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      setState.mockRestore();
      forceUpdate.mockRestore();
      instance.tableStore.dispose();
    }
  });

  it('T03 commits customized, temporary, flex and auto heights without render transition warnings', async () => {
    const context = ConfigContext._currentValue;
    const load = jest.fn(() => Promise.resolve({ columns: {}, heightType: TableHeightType.fixed, height: 460 }));
    const value = { ...context, getConfig: key => key === 'tableCustomizedLoad' ? load : context.getConfig(key) };
    const errors = jest.spyOn(console, 'error');
    const table = <PerformanceTable data={[]} queryBar={false} height={300} minHeight={0} customizedCode="height" customizable />;
    let wrapper;
    try {
      wrapper = mount(<ConfigContext.Provider value={value}>{table}</ConfigContext.Provider>);
      const instance = wrapper.find(PerformanceTable).instance();
      const check = height => {
        wrapper.update();
        expect(instance.tableRef.current.style.height).toBe(`${height}px`);
        expect(instance.tableStore.totalHeight).toBe(height);
      };
      check(300);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      check(460);
      wrapper.setProps({ children: React.cloneElement(table, { height: 520 }) });
      check(460);
      act(() => {
        runInAction(() => {
          instance.tableStore.customized = { columns: {} };
          instance.tableStore.tempCustomized = { columns: {}, heightType: TableHeightType.fixed, height: 380 };
        });
        instance.forceUpdate();
      });
      check(380);
      act(() => {
        runInAction(() => {
          instance.tableStore.tempCustomized = { columns: {} };
          instance.tableStore.customized = { columns: {}, heightType: TableHeightType.flex, heightDiff: -250 };
        });
        instance.forceUpdate();
      });
      check(document.documentElement.clientHeight + 250);
      wrapper.setProps({ children: React.cloneElement(table, { autoHeight: true }) });
      check(instance.getTableHeaderHeight() + 10);
      wrapper.setProps({ children: React.cloneElement(table, { customizable: false, height: 520 }) });
      check(520);
      const committed = instance.tableStore.totalHeight;
      wrapper.unmount();
      wrapper = undefined;
      expect(instance.tableStore.totalHeight).toBe(committed);
      expect(errors.mock.calls.filter(args => args.some(value => /Cannot update during|state transition|unmounted component/.test(String(value))))).toEqual([]);
    } finally {
      if (wrapper) wrapper.unmount();
      errors.mockRestore();
    }
  });

  it('commits rendered height on mount, prop, state and context-only updates', () => {
    const context = ConfigContext._currentValue;
    const table = <PerformanceTable data={[]} queryBar={false} height={300} minHeight={0} />;
    const wrapper = mount(<ConfigContext.Provider value={context}>{table}</ConfigContext.Provider>);
    const instance = wrapper.find(PerformanceTable).instance();
    const checkHeight = () => expect(instance.tableStore.totalHeight).toBe(parseFloat(instance.tableRef.current.style.height));
    try {
      checkHeight();
      wrapper.setProps({ children: React.cloneElement(table, { height: 420 }) });
      checkHeight();
      expect(instance.tableStore.totalHeight).toBe(420);
      const nextContext = { ...context, getConfig: key => key === 'performanceTableAutoHeight' ? true : context.getConfig(key) };
      wrapper.setProps({ value: nextContext });
      expect(instance.tableStore.context).toBe(nextContext);
      checkHeight();
      expect(instance.tableStore.totalHeight).not.toBe(420);
      instance.setState({ contentHeight: 150 });
      wrapper.update();
      checkHeight();
      wrapper.setProps({ value: context });
      checkHeight();
      expect(instance.tableStore.totalHeight).toBe(420);
    } finally {
      wrapper.unmount();
    }
  });
});
