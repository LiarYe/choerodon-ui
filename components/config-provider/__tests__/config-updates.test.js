import React, { memo, useContext } from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import ConfigProvider from '../ConfigProvider';
import ConfigContext from '../ConfigContext';
import DataSet from '../../../components-dataset';
import useDataSet from '../../../components-pro/use-data-set';

describe('ConfigProvider configuration updates', () => {
  it.each([undefined, []])('preserves a dirty DataSet across children updates with dependencies %p', deps => {
    let context;
    let dataSet;
    const factory = jest.fn(() => ({
      fields: [{ name: 'name', type: 'string' }],
      data: [{ name: 'original' }],
    }));
    const Consumer = ({ label }) => {
      context = useContext(ConfigContext);
      dataSet = useDataSet(factory, deps);
      return <span>{label}</span>;
    };
    const lovModalProps = { style: { width: 100 } };
    const wrapper = mount(
      <ConfigProvider lovModalProps={lovModalProps}>
        <ConfigProvider><Consumer label="first" /></ConfigProvider>
      </ConfigProvider>,
    );
    const previousContext = context;
    const previousDataSet = dataSet;
    const record = dataSet.current;
    expect(dataSet).toBeInstanceOf(DataSet);
    expect(dataSet.dirty).toBe(false);
    act(() => { record.set('name', 'edited'); });
    expect(dataSet.dirty).toBe(true);
    wrapper.setProps({
      children: <ConfigProvider><Consumer label="next" /></ConfigProvider>,
    });
    expect(wrapper.text()).toBe('next');
    expect(context).toBe(previousContext);
    expect(context.getConfig).toBe(previousContext.getConfig);
    expect(dataSet).toBe(previousDataSet);
    expect(dataSet.current).toBe(record);
    expect(dataSet.current.get('name')).toBe('edited');
    expect(dataSet.current.dirty).toBe(true);
    expect(dataSet.dirty).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('propagates replaced object and function configurations through a stable nested provider', () => {
    let context;
    const Consumer = memo(() => {
      context = useContext(ConfigContext);
      return <span>{context.getConfig('lovModalProps').style.width}:{context.getTooltip('button')}</span>;
    });
    const child = <ConfigProvider><Consumer /></ConfigProvider>;
    const firstTooltip = () => 'always';
    const nextTooltip = () => 'overflow';
    const wrapper = mount(
      <ConfigProvider lovModalProps={{ style: { width: 1 } }} tooltip={firstTooltip}>{child}</ConfigProvider>,
    );
    const previous = context;
    wrapper.setProps({ lovModalProps: { style: { width: 2 } }, tooltip: nextTooltip });
    expect(wrapper.text()).toBe('2:overflow');
    expect(context.getConfig('tooltip')).toBe(nextTooltip);
    expect(context.getConfig).not.toBe(previous.getConfig);
    expect(previous.getConfig('lovModalProps').style.width).toBe(1);
    expect(previous.getConfig('tooltip')).toBe(firstTooltip);
    wrapper.unmount();
  });

  it('preserves React identity and plain nested reactivity across prop updates', () => {
    let context;
    const callback = () => null;
    const type = React.forwardRef(callback);
    const node = React.createElement(type);
    const Consumer = observer(() => {
      context = useContext(ConfigContext);
      return <span>{context.getConfig('lovModalProps').style.width}</span>;
    });
    const wrapper = mount(
      <ConfigProvider lovModalProps={{ title: node, onOk: callback, style: { width: 1 } }}>
        <Consumer />
      </ConfigProvider>,
    );
    const previous = context.getConfig('lovModalProps');
    expect(previous.title).toBe(node);
    expect(previous.title.type).toBe(type);
    expect(previous.onOk).toBe(callback);
    act(() => runInAction(() => { previous.style.width = 2; }));
    expect(wrapper.text()).toBe('2');
    const next = React.createElement(React.memo(callback));
    wrapper.setProps({ lovModalProps: { title: next, onOk: callback, style: { width: 3 } } });
    expect(context.getConfig('lovModalProps').title).toBe(next);
    expect(context.getConfig('lovModalProps').onOk).toBe(callback);
    expect(previous.title).toBe(node);
    act(() => runInAction(() => { context.getConfig('lovModalProps').style.width = 4; }));
    expect(wrapper.text()).toBe('4');
    wrapper.unmount();
  });

  it('updates a stable memoized consumer without mutating an earlier context snapshot', () => {
    let context;
    const Consumer = memo(() => {
      context = useContext(ConfigContext);
      return <span>{context.getPrefixCls('button')}:{context.getProPrefixCls('table')}</span>;
    });
    const child = <Consumer />;
    const wrapper = mount(<ConfigProvider prefixCls="first" proPrefixCls="first-pro">{child}</ConfigProvider>);
    const previous = context;
    expect(wrapper.text()).toBe('first-button:first-pro-table');
    wrapper.setProps({ prefixCls: 'next', proPrefixCls: 'next-pro' });
    expect(wrapper.text()).toBe('next-button:next-pro-table');
    expect(previous.getPrefixCls('button')).toBe('first-button');
    expect(context.getPrefixCls('button', 'custom')).toBe('custom');
    wrapper.unmount();
  });

  it('preserves observable nested configuration updates', () => {
    const customizable = observable({ Table: false });
    const Consumer = observer(() => {
      const context = useContext(ConfigContext);
      return <span>{String(context.getCustomizable('Table'))}</span>;
    });
    const wrapper = mount(<ConfigProvider customizable={customizable}><Consumer /></ConfigProvider>);
    expect(wrapper.text()).toBe('false');
    act(() => runInAction(() => { customizable.Table = true; }));
    expect(wrapper.text()).toBe('true');
    wrapper.unmount();
  });

  it('distinguishes explicit undefined overrides from removed keys and isolates siblings', () => {
    const Consumer = observer(() => {
      const context = useContext(ConfigContext);
      return <span>{String(context.getConfig('tableBorder'))}</span>;
    });
    const children = config => <><ConfigProvider {...config}><Consumer /></ConfigProvider><ConfigProvider><Consumer /></ConfigProvider></>;
    const wrapper = mount(<ConfigProvider tableBorder>{children({ tableBorder: undefined })}</ConfigProvider>);
    expect(wrapper.find('span').map(node => node.text())).toEqual(['undefined', 'true']);
    wrapper.setProps({ children: children({ tableBorder: false }) });
    expect(wrapper.find('span').map(node => node.text())).toEqual(['false', 'true']);
    wrapper.setProps({ children: children({}) });
    expect(wrapper.find('span').map(node => node.text())).toEqual(['true', 'true']);
    wrapper.setProps({ tableBorder: false });
    expect(wrapper.find('span').map(node => node.text())).toEqual(['false', 'false']);
    wrapper.unmount();
  });
});
