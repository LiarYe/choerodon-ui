import React, { memo, useContext } from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { autorun, computed, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import ConfigProvider from '../ConfigProvider';
import ConfigContext from '../ConfigContext';
import DataSet from '../../../components-dataset';
import useDataSet from '../../../components-pro/use-data-set';

const consumers = [
  ['plain', component => component],
  ['memo', memo],
  ['observer', observer],
];

describe('useDataSet committed configuration updates', () => {
  it.each(consumers.reduce((cases, [name, wrap]) => cases.concat(
    [undefined, []].map(deps => [name, wrap, deps]),
  ), []))('preserves business state and visible output for %s with wrapper %p and dependencies %p', (name, wrap, deps) => {
    let dataSet;
    let context;
    let rendering = false;
    const update = jest.fn();
    const query = jest.spyOn(DataSet.prototype, 'query').mockResolvedValue(undefined);
    const factory = jest.fn(() => ({
      fields: [{ name: 'name', type: 'string' }],
      data: [{ name: 'original' }, { name: 'second' }],
      autoQuery: true,
      events: { update },
    }));
    const reads = [];
    const Consumer = wrap(({ label }) => {
      rendering = true;
      context = useContext(ConfigContext);
      dataSet = useDataSet(factory, deps);
      const content = <button type="button" onClick={() => reads.push(dataSet.getConfig('buttonTooltip'))}>
        {label}:{dataSet.getConfig('buttonTooltip')}
      </button>;
      rendering = false;
      return content;
    });
    let wrapper;
    let dispose;
    try {
      act(() => {
        wrapper = mount(<ConfigProvider buttonTooltip="always"><Consumer label="first" /></ConfigProvider>);
      });
      const previousContext = context;
      const previousDataSet = dataSet;
      const record = dataSet.current;
      const events = dataSet.events;
      act(() => {
        record.set('name', 'edited');
        dataSet.select(record);
        runInAction(() => {
          dataSet.currentPage = 3;
          dataSet.pageSize = 20;
        });
      });
      const tooltip = computed(() => previousDataSet.getConfig('buttonTooltip'));
      const values = [];
      const renderUpdates = [];
      dispose = autorun(() => {
        values.push(tooltip.get());
        renderUpdates.push(rendering);
      });
      act(() => {
        wrapper.setProps({ buttonTooltip: 'overflow', children: <Consumer label="next" /> });
      });
      wrapper.update();
      expect(dataSet).toBe(previousDataSet);
      expect(dataSet.current).toBe(record);
      expect(record.get('name')).toBe('edited');
      expect(record.dirty).toBe(true);
      expect(dataSet.dirty).toBe(true);
      expect(dataSet.selected).toEqual([record]);
      expect(dataSet.currentPage).toBe(3);
      expect(dataSet.pageSize).toBe(20);
      expect(dataSet.events).toBe(events);
      expect(dataSet.getConfig('buttonTooltip')).toBe('overflow');
      expect(wrapper.text()).toBe('next:overflow');
      wrapper.find('button').simulate('click');
      expect(reads).toEqual(['overflow']);
      expect(values).toEqual(['always', 'overflow']);
      expect(renderUpdates).toEqual([false, false]);
      expect(previousContext.getConfig('buttonTooltip')).toBe('always');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledTimes(1);
      act(() => { record.set('name', 'edited again'); });
      expect(update).toHaveBeenCalledTimes(2);
    } finally {
      if (dispose) dispose();
      if (wrapper) wrapper.unmount();
      query.mockRestore();
    }
  });

  it.each(consumers)('follows nested overrides, removal, explicit undefined and parent changes without changing snapshots for %s', (name, wrap) => {
    const dataSets = {};
    const contexts = {};
    const factory = jest.fn(() => ({}));
    const Consumer = wrap(({ id }) => {
      dataSets[id] = useDataSet(factory, []);
      contexts[id] = useContext(ConfigContext);
      return <span data-id={id}>{String(dataSets[id].getConfig('buttonTooltip'))}</span>;
    });
    const children = config => <>
      <ConfigProvider {...config}><Consumer id="nested" /></ConfigProvider>
      <ConfigProvider><Consumer id="sibling" /></ConfigProvider>
    </>;
    const wrapper = mount(<ConfigProvider buttonTooltip="always">{children({ buttonTooltip: 'overflow' })}</ConfigProvider>);
    const nested = dataSets.nested;
    const sibling = dataSets.sibling;
    const previousContext = contexts.nested;
    const values = [];
    const dispose = autorun(() => values.push([nested.getConfig('buttonTooltip'), sibling.getConfig('buttonTooltip')]));
    try {
      act(() => { wrapper.setProps({ children: children({ buttonTooltip: undefined }) }); });
      expect(nested.getConfig('buttonTooltip')).toBeUndefined();
      expect(sibling.getConfig('buttonTooltip')).toBe('always');
      wrapper.update();
      expect(wrapper.find('span[data-id="nested"]').text()).toBe('undefined');
      expect(wrapper.find('span[data-id="sibling"]').text()).toBe('always');
      act(() => { wrapper.setProps({ children: children({}) }); });
      expect(nested.getConfig('buttonTooltip')).toBe('always');
      wrapper.update();
      expect(wrapper.find('span[data-id="nested"]').text()).toBe('always');
      act(() => { wrapper.setProps({ buttonTooltip: 'none' }); });
      expect(nested.getConfig('buttonTooltip')).toBe('none');
      expect(sibling.getConfig('buttonTooltip')).toBe('none');
      wrapper.update();
      expect(wrapper.find('span[data-id="nested"]').text()).toBe('none');
      expect(wrapper.find('span[data-id="sibling"]').text()).toBe('none');
      expect(values[values.length - 1]).toEqual(['none', 'none']);
      expect(previousContext.getConfig('buttonTooltip')).toBe('overflow');
      expect(dataSets.nested).toBe(nested);
      expect(dataSets.sibling).toBe(sibling);
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      dispose();
      wrapper.unmount();
    }
  });

  it.each(consumers)('recreates only for changed dependencies and leaves retired instances on their last configuration for %s', (name, wrap) => {
    let dataSet;
    const factory = jest.fn(value => ({ data: [{ value }] }));
    const Consumer = wrap(({ value }) => {
      dataSet = useDataSet(() => factory(value), [value]);
      return <span>{dataSet.current.get('value')}:{dataSet.getConfig('buttonTooltip')}</span>;
    });
    const wrapper = mount(<ConfigProvider buttonTooltip="always"><Consumer value={1} /></ConfigProvider>);
    const first = dataSet;
    try {
      act(() => { wrapper.setProps({ buttonTooltip: 'overflow' }); });
      expect(dataSet).toBe(first);
      wrapper.update();
      expect(wrapper.text()).toBe('1:overflow');
      act(() => { wrapper.setProps({ children: <Consumer value={2} /> }); });
      const second = dataSet;
      expect(second).not.toBe(first);
      expect(second.current.get('value')).toBe(2);
      wrapper.update();
      expect(wrapper.text()).toBe('2:overflow');
      act(() => { wrapper.setProps({ buttonTooltip: 'none' }); });
      expect(dataSet).toBe(second);
      expect(second.getConfig('buttonTooltip')).toBe('none');
      expect(first.getConfig('buttonTooltip')).toBe('overflow');
      wrapper.update();
      expect(wrapper.text()).toBe('2:none');
      expect(factory).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
    }
  });
});
