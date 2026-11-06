import React, { useContext } from 'react';
import { mount } from 'enzyme';
import { autorun, isObservableProp, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import Mentions from '../../mentions';
import TextArea from '../../text-area/TextArea';
import Cascader from '../../cascader';
import PerformanceTable from '../../performance-table/Table';
import ConfigProvider from '../../../components/config-provider/ConfigProvider';
import ConfigContext from '../../../components/config-provider/ConfigContext';

describe('migration regressions', () => {
  it('mounts Mentions on the public observed TextArea and updates controlled input', () => {
    expect(Object.getPrototypeOf(Mentions.prototype)).toBe(TextArea.prototype);
    const wrapper = mount(<Mentions value="@first" />);
    const instance = wrapper.instance();
    expect(isObservableProp(instance, 'measuring')).toBe(true);
    expect(isObservableProp(instance, 'resized')).toBe(true);
    wrapper.setProps({ value: '@second', rows: 3, disabled: true });
    expect(wrapper.find('textarea').prop('value')).toBe('@second');
    expect(wrapper.find('textarea').prop('rows')).toBe(3);
    expect(wrapper.find('textarea').prop('disabled')).toBe(true);
    wrapper.unmount();
  });

  it('caches frozen Cascader options without writing parent fields into caller data', () => {
    const child = Object.freeze({ value: 'child', meaning: 'Child' });
    const root = Object.freeze({ value: 'root', meaning: 'Root', children: Object.freeze([child]) });
    const options = Object.freeze([root]);
    const wrapper = mount(<Cascader options={options} />);
    const instance = wrapper.instance();
    const first = instance.options;
    expect(first).toBe(instance.options);
    expect(first.get(1).get('parentValue')).toBe('root');
    expect(root).not.toHaveProperty('parentValue');
    expect(child).not.toHaveProperty('parentValue');
    wrapper.setProps({ disabled: true });
    expect(instance.options).toBe(first);
    wrapper.setProps({ options: [{ value: 'next', meaning: 'Next' }] });
    expect(instance.options).not.toBe(first);
    expect(instance.options.get(0).get('value')).toBe('next');
    wrapper.setProps({ multiple: true });
    expect(instance.options.selection).toBe('multiple');
    wrapper.unmount();
    expect(instance.checkValueReaction).toBeUndefined();
  });

  it('invalidates Cascader options for observable tree updates and field mapping changes', () => {
    const options = observable([{ value: 'root', meaning: 'Root' }]);
    const wrapper = mount(<Cascader options={options} />);
    const instance = wrapper.instance();
    const first = instance.options;
    runInAction(() => options[0].meaning = 'Changed');
    expect(instance.options).not.toBe(first);
    expect(instance.options.get(0).get('meaning')).toBe('Changed');
    wrapper.setProps({ textField: 'label', options: [{ value: 'next', label: 'Label' }] });
    expect(instance.options.get(0).get('label')).toBe('Label');
    wrapper.unmount();
  });

  it('syncs non-column props, removed props and context-only changes in PerformanceTable', () => {
    const context = ConfigContext._currentValue;
    const table = <PerformanceTable data={[]} columns={[]} queryBar={false} />;
    const wrapper = mount(<ConfigContext.Provider value={context}>{table}</ConfigContext.Provider>);
    const instance = wrapper.find(PerformanceTable).instance();
    const store = instance.tableStore;
    const values = [];
    const dispose = autorun(() => values.push([store.columnTitleEditable, store.columnDraggable, store.autoHeight, store.proPrefixCls]));
    wrapper.setProps({ children: React.cloneElement(table, { columnTitleEditable: true, columnDraggable: true, autoHeight: true, height: 420, classPrefix: 'next-table' }) });
    expect(store.props).toBe(instance.props);
    expect(store.columnTitleEditable).toBe(true);
    expect(store.columnDraggable).toBe(true);
    expect(store.autoHeight).toBe(true);
    expect(store.prefixCls).toBe('next-table');
    wrapper.setProps({ children: table });
    expect(store.props).not.toHaveProperty('columnDraggable');
    const nextContext = { ...context, getProPrefixCls: suffix => `next-${suffix}`, getConfig: key => key === 'performanceTableColumnTitleEditable' ? true : context.getConfig(key) };
    wrapper.setProps({ value: nextContext });
    expect(store.context).toBe(nextContext);
    expect(store.proPrefixCls).toBe('next-table');
    expect(store.columnTitleEditable).toBe(true);
    expect(values[values.length - 1][3]).toBe('next-table');
    dispose();
    wrapper.unmount();
  });

  it('updates ConfigProvider overrides and falls back to changing parent config when removed', () => {
    const Consumer = observer(() => {
      const context = useContext(ConfigContext);
      return <span>{context.getProPrefixCls('table')}:{String(context.getConfig('performanceTableColumnHideable'))}</span>;
    });
    const renderChild = config => <ConfigProvider {...config}><Consumer /></ConfigProvider>;
    const wrapper = mount(<ConfigProvider proPrefixCls="parent" performanceTableColumnHideable>{renderChild({ proPrefixCls: 'child', performanceTableColumnHideable: false })}</ConfigProvider>);
    expect(wrapper.text()).toBe('child-table:false');
    wrapper.setProps({ children: renderChild({ proPrefixCls: 'updated' }) });
    expect(wrapper.text()).toBe('updated-table:true');
    wrapper.setProps({ children: renderChild({}) });
    expect(wrapper.text()).toBe('parent-table:true');
    wrapper.setProps({ proPrefixCls: 'new-parent', performanceTableColumnHideable: false });
    expect(wrapper.text()).toBe('new-parent-table:false');
    wrapper.unmount();
  });
});
