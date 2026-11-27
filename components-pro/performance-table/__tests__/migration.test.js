import React from 'react';
import { mount } from 'enzyme';
import { autorun } from 'mobx';
import { DragDropContext, Droppable } from 'choerodon-ui/lib/drag-drop-context';
import PerformanceTable from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';

describe('PerformanceTable migration mounting', () => {
  it('resolves a cross-table clone by draggableId after its source index changes', () => {
    const records = [{ id: 7 }, { id: 0 }];
    const wrapper = mount(
      <DragDropContext onDragEnd={() => {}}>
        <PerformanceTable rowDraggable customDragDropContenxt rowKey="id" data={records} columns={[{ key: 'id', dataKey: 'id', width: 100 }]} width={500} height={300} queryBar={false} />
      </DragDropContext>,
    );
    try {
      const renderClone = wrapper.find(Droppable).first().prop('renderClone');
      const renderRow = jest.spyOn(wrapper.find(PerformanceTable).instance(), 'renderDraggingRow').mockReturnValue(null);
      const provided = { draggableProps: {} };
      const snapshot = {};
      renderClone(provided, snapshot, { draggableId: '0', source: { index: 0 } });
      expect(renderRow).toHaveBeenCalledWith(records[1], provided, snapshot);
      expect(renderClone(provided, snapshot, { draggableId: 'missing', source: { index: 0 } })).toBeNull();
    } finally {
      wrapper.unmount();
    }
  });

  it('measures the keyless draggable by absolute index after the virtual window scrolls', () => {
    const data = Array.from({ length: 60 }, (_, value) => ({ value }));
    const wrapper = mount(<PerformanceTable rowDraggable virtualized rowHeight={30} data={data} columns={[{ key: 'value', dataKey: 'value', width: 100 }]} width={500} height={150} queryBar={false} />);
    try {
      const table = wrapper.instance();
      table.scrollY = -900;
      table.forceUpdate();
      wrapper.update();
      const row = table.tableRef.current.querySelector('div[data-rowindex="30"]');
      row.style.margin = '2px 0';
      row.getBoundingClientRect = () => ({ height: 30 });
      expect(table.getLiftedRow('30')).toEqual({ id: '30', index: 30, height: 34 });
      expect(table.tableRows[0]).toEqual([row, data[30]]);
    } finally {
      wrapper.unmount();
    }
  });

  it('reports the accepted drop order once and does not report a cancelled drop', () => {
    const data = ['A', 'B', 'C'].map(key => ({ key }));
    const onDragEnd = jest.fn();
    const wrapper = mount(<PerformanceTable columns={[]} data={data} queryBar={false} width={500} height={300} onDragEnd={onDragEnd} />);
    const table = wrapper.instance();
    const result = { draggableId: 'A', reason: 'DROP', source: { droppableId: 'table', index: 0 }, destination: { droppableId: 'table', index: 1 } };
    const provided = { announce: jest.fn() };
    try {
      table.handleDragEnd(result, provided);
      expect(table.state.data).toEqual([data[1], data[0], data[2]]);
      expect(onDragEnd.mock.calls).toEqual([[result, provided, table.state.data]]);
      table.handleDragEnd({ ...result, reason: 'CANCEL', destination: null }, provided);
      expect(table.state.data).toEqual([data[1], data[0], data[2]]);
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
    }
  });

  it('updates observed store values with stable columns and restores context defaults after prop removal', () => {
    const context = ConfigContext._currentValue;
    const columns = [{ key: 'name', dataKey: 'name', title: 'Name', width: 100 }];
    const table = <PerformanceTable columns={columns} data={[{ key: '1', name: 'First' }]} queryBar={false} width={500} height={300} virtualized={false} />;
    const wrapper = mount(<ConfigContext.Provider value={context}>{table}</ConfigContext.Provider>);
    const instance = wrapper.find(PerformanceTable).instance();
    const store = instance.tableStore;
    const values = [];
    const dispose = autorun(() => values.push({
      titleEditable: store.columnTitleEditable,
      draggable: store.columnDraggable,
      hideable: store.columnHideable,
      mouseBatch: store.useMouseBatchChoose,
      autoHeight: store.autoHeight,
      heightType: store.originalHeightType,
      prefix: store.prefixCls,
      proPrefix: store.proPrefixCls,
      queryBar: store.queryBar,
    }));
    try {
      const originalColumns = store.originalColumns;
      wrapper.setProps({ children: React.cloneElement(table, {
        columnTitleEditable: true,
        columnDraggable: true,
        columnHideable: false,
        useMouseBatchChoose: true,
        height: 420,
        classPrefix: 'updated-table',
      }) });
      expect(store.originalColumns).toBe(originalColumns);
      expect(store.props).toBe(instance.props);
      expect(values[values.length - 1]).toMatchObject({ titleEditable: true, draggable: true, hideable: false, mouseBatch: true, heightType: 'fixed', prefix: 'updated-table' });
      expect(wrapper.find('[role="grid"]').hasClass('updated-table')).toBe(true);
      wrapper.setProps({ children: table });
      expect(store.props).not.toHaveProperty('columnHideable');
      expect(store.props.height).toBe(300);
      expect(store.originalHeightType).toBe('fixed');
      const nextContext = {
        ...context,
        getProPrefixCls: suffix => `changed-${suffix}`,
        getConfig: key => key === 'performanceTableColumnHideable' ? false : context.getConfig(key),
      };
      wrapper.setProps({ value: nextContext });
      expect(store.context).toBe(nextContext);
      expect(values[values.length - 1]).toMatchObject({ hideable: false, proPrefix: 'changed-table' });
      expect(wrapper.text()).toContain('Name');
      expect(instance.state.data).toEqual([{ key: '1', name: 'First' }]);
    } finally {
      dispose();
      wrapper.unmount();
    }
  });
});
