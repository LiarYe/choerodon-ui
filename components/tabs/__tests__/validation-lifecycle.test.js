import React, { useCallback } from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { observable, runInAction } from 'mobx';
import DataSet from 'choerodon-ui/dataset';
import TabPane from '../TabPane';
import TabsContext from '../TabsContext';

jest.mock('react', () => {
  const react = jest.requireActual('react');
  return { ...react, useCallback: jest.fn(react.useCallback) };
});

describe('TabPane validation event lifecycle', () => {
  it.each([true, false])('preserves other panes when disabling tips with a shared validationMap and active is %s', async active => {
    const createDataSet = () => new DataSet({ forceValidate: true, fields: [{ name: 'name', required: true }], data: [{}] });
    const first = createDataSet();
    const second = createDataSet();
    const validationMap = observable.map();
    const render = showInvalidTips => (
      <div>
        <TabsContext.Provider value={{ validationMap, showInvalidTips }}>
          <TabPane active={active} eventKey="first" dataSet={first} />
        </TabsContext.Provider>
        <TabsContext.Provider value={{ validationMap, showInvalidTips: true }}>
          <TabPane active eventKey="second" dataSet={second} />
        </TabsContext.Provider>
      </div>
    );
    const wrapper = mount(render(true));
    try {
      await act(async () => {
        await first.validate();
        await second.validate();
      });
      expect(Array.from(validationMap.entries())).toEqual([['first', false], ['second', false]]);
      act(() => { wrapper.setProps(render(false).props); });
      expect(Array.from(validationMap.entries())).toEqual([['second', false]]);
      await act(async () => { await first.validate(); });
      expect(Array.from(validationMap.entries())).toEqual([['second', false]]);
      act(() => { second.reset(); });
      expect(Array.from(validationMap.entries())).toEqual([['second', true]]);
      act(() => { wrapper.setProps(render(true).props); });
      act(() => { first.reset(); });
      expect(validationMap.get('first')).toBe(true);
      expect(validationMap.get('second')).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it.each(['pane', undefined])('only removes its own entry for reports with tips disabled and eventKey %s', eventKey => {
    const validationMap = observable.map();
    useCallback.mockClear();
    let wrapper;
    try {
      wrapper = mount(
        <TabsContext.Provider value={{ validationMap, showInvalidTips: false }}>
          <TabPane active eventKey={eventKey} />
        </TabsContext.Provider>,
      );
      const handleValidationReport = useCallback.mock.results[0].value;
      runInAction(() => {
        validationMap.set('pane', false);
        validationMap.set('other-invalid', false);
        validationMap.set('other-valid', true);
      });
      act(() => { handleValidationReport({ showInvalid: true, component: {} }); });
      expect(validationMap.has('pane')).toBe(eventKey === undefined);
      expect(validationMap.get('other-invalid')).toBe(false);
      expect(validationMap.get('other-valid')).toBe(true);
    } finally {
      useCallback.mockClear();
      if (wrapper) wrapper.unmount();
    }
  });

  it.each([true, false])('clears disabled tips and does not restore stale failures when active is %s', async active => {
    const createDataSet = () => new DataSet({ forceValidate: true, fields: [{ name: 'name', required: true }], data: [{}] });
    const first = createDataSet();
    const second = createDataSet();
    const validationMap = observable.map();
    const render = (showInvalidTips, dataSet = [first, second]) => (
      <TabsContext.Provider value={{ validationMap, showInvalidTips }}>
        <TabPane active={active} eventKey="pane" dataSet={dataSet} />
      </TabsContext.Provider>
    );
    const wrapper = mount(render(true));
    try {
      await act(async () => {
        await first.validate();
        await second.validate();
      });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { wrapper.setProps(render(false).props); });
      expect(validationMap.size).toBe(0);
      await act(async () => { await first.validate(); });
      expect(validationMap.size).toBe(0);
      act(() => { wrapper.setProps(render(false, [second]).props); });
      expect(validationMap.size).toBe(0);
      act(() => { wrapper.setProps(render(true).props); });
      act(() => { first.reset(); });
      expect(validationMap.get('pane')).toBe(true);
      await act(async () => { await second.validate(); });
      expect(validationMap.get('pane')).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it.each(['reset', 'recordReset', 'remove'])('reports %s to the current eventKey and validationMap', async event => {
    const dataSet = new DataSet({ forceValidate: true, fields: [{ name: 'name', required: true }], data: [{}] });
    const oldMap = observable.map();
    const validationMap = observable.map();
    const render = (eventKey, map) => (
      <TabsContext.Provider value={{ validationMap: map, showInvalidTips: true }}>
        <TabPane active eventKey={eventKey} dataSet={dataSet} />
      </TabsContext.Provider>
    );
    const wrapper = mount(render('old', oldMap));
    try {
      await act(async () => { await dataSet.validate(); });
      expect(oldMap.get('old')).toBe(false);
      act(() => { wrapper.setProps(render('current', validationMap).props); });
      await act(async () => { await dataSet.validate(); });
      expect(validationMap.get('current')).toBe(false);
      act(() => {
        if (event === 'reset') dataSet.reset();
        else if (event === 'recordReset') dataSet.get(0).reset();
        else dataSet.remove(dataSet.get(0));
      });
      expect(validationMap.get('current')).toBe(true);
      expect(validationMap.has('old')).toBe(false);
      expect(oldMap.get('old')).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('uses a replacement validationMap with the same eventKey and detaches on unmount', async () => {
    const dataSet = new DataSet({ forceValidate: true, fields: [{ name: 'name', required: true }], data: [{}] });
    const oldMap = observable.map();
    const validationMap = observable.map();
    const render = map => (
      <TabsContext.Provider value={{ validationMap: map, showInvalidTips: true }}>
        <TabPane active eventKey="same" dataSet={dataSet} />
      </TabsContext.Provider>
    );
    const wrapper = mount(render(oldMap));
    try {
      await act(async () => { await dataSet.validate(); });
      act(() => { wrapper.setProps(render(validationMap).props); });
      await act(async () => { await dataSet.validate(); });
      expect(validationMap.get('same')).toBe(false);
      act(() => { dataSet.reset(); });
      expect(validationMap.get('same')).toBe(true);
      expect(oldMap.get('same')).toBe(false);
    } finally {
      wrapper.unmount();
    }
    await act(async () => { await dataSet.validate(); });
    expect(validationMap.get('same')).toBe(true);
  });
});
