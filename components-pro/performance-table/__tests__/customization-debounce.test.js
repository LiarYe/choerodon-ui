import React from 'react';
import { mount } from 'enzyme';
import { autorun, configure, runInAction } from 'mobx';
import TableStore from '../TableStore';
import PerformanceTable from '../Table';
import ConfigContext from '../../../components/config-provider/ConfigContext';

describe('PerformanceTable customization debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    configure({ enforceActions: 'always' });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    configure({ enforceActions: 'never' });
  });

  it('keeps the cold first and second instance saves inside actions with forwarded arguments', async () => {
    const warning = jest.spyOn(console, 'warn');
    const save = jest.fn();
    const context = ConfigContext._currentValue;
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const disposers = [];
    try {
      for (let index = 0; index < 2; index += 1) {
        const node = {
          props: { customizedCode: `table-${index}`, customizable: false, columns: [] },
          context: { ...context, getConfig: key => key === 'tableCustomizedSave' ? save : context.getConfig(key) },
          forceUpdate: jest.fn(),
        };
        const store = new TableStore(node);
        runInAction(() => { store.props = { ...node.props, customizable: true }; });
        disposers.push(autorun(() => store.customized));
        const direct = { columns: { direct: { width: 100 } } };
        store.saveCustomized(direct);
        expect(store.customized).toEqual(direct);
        const customized = { columns: { name: { width: 140 + index } } };
        const otherInfo = { columnDataSet: {} };
        store.saveCustomizedDebounce(customized, otherInfo);
        store.saveCustomizedDebounce.flush();
        expect(store.customized).toEqual(customized);
        expect(save).toHaveBeenLastCalledWith(`table-${index}`, store.customized, 'PerformanceTable', otherInfo);
        store.saveCustomizedDebounce({ columns: { timer: { width: 180 } } }, otherInfo);
        now.mockReturnValue((index + 1) * 1000);
        jest.advanceTimersByTime(1000);
        expect(store.customized.columns.timer.width).toBe(180);
        store.saveCustomizedDebounce.cancel();
      }
      expect(save).toHaveBeenCalledTimes(6);
      expect(warning.mock.calls.filter(args => args.join(' ').includes('strict-mode'))).toEqual([]);
    } finally {
      disposers.forEach(dispose => dispose());
      now.mockRestore();
      warning.mockRestore();
    }
  });

  it('cancels a pending save on unmount without updating or saving later', () => {
    const save = jest.fn();
    const context = ConfigContext._currentValue;
    const value = { ...context, getConfig: key => key === 'tableCustomizedSave' ? save : context.getConfig(key) };
    const wrapper = mount(<ConfigContext.Provider value={value}><PerformanceTable columns={[]} data={[]} queryBar={false} width={500} height={300} virtualized={false} customizedCode="unmount" customizable={false} /></ConfigContext.Provider>);
    const store = wrapper.find(PerformanceTable).instance().tableStore;
    jest.runOnlyPendingTimers();
    expect(jest.getTimerCount()).toBe(0);
    runInAction(() => { store.props = { ...store.props, customizable: true }; });
    store.saveCustomizedDebounce({ columns: { name: { width: 150 } } });
    const cancel = jest.spyOn(store.saveCustomizedDebounce, 'cancel');
    expect(save).not.toHaveBeenCalled();
    wrapper.unmount();
    const update = jest.spyOn(store.node, 'forceUpdate');
    expect(save).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    store.saveCustomizedDebounce.flush();
    jest.runAllTimers();
    expect(jest.getTimerCount()).toBe(0);
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    cancel.mockRestore();
    update.mockRestore();
  });
});
