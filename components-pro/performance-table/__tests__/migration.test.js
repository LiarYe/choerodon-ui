import React from 'react';
import { mount } from 'enzyme';
import { autorun } from 'mobx';
import PerformanceTable from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';

describe('PerformanceTable migration mounting', () => {
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
