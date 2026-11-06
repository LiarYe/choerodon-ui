import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { observable } from 'mobx';
import DataSet from 'choerodon-ui/dataset';
import TabPane from '../TabPane';
import TabsContext from '../TabsContext';

describe('TabPane DataSet replacement lifecycle', () => {
  it.each([true, false])('removes departed validation without clearing retained failures when active is %s', async active => {
    const createDataSet = () => new DataSet({
      forceValidate: true,
      fields: [{ name: 'name', required: true }],
      data: [{}],
    });
    const first = createDataSet();
    const retained = createDataSet();
    const replacement = createDataSet();
    const validationMap = observable.map();
    const render = dataSet => (
      <TabsContext.Provider value={{ validationMap, showInvalidTips: true }}>
        <TabPane active={active} eventKey="pane" dataSet={dataSet} />
      </TabsContext.Provider>
    );
    const wrapper = mount(render([first, retained]));
    try {
      await act(async () => {
        await first.validate();
        await retained.validate();
      });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { wrapper.setProps(render([replacement, retained]).props); });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { retained.reset(); });
      expect(validationMap.get('pane')).toBe(true);
      await act(async () => { await first.validate(); });
      expect(validationMap.get('pane')).toBe(true);
      await act(async () => { await replacement.validate(); });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { wrapper.setProps(render([retained]).props); });
      expect(validationMap.get('pane')).toBe(true);
      await act(async () => { await retained.validate(); });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { wrapper.setProps(render(undefined).props); });
      expect(validationMap.get('pane')).toBe(true);
      await act(async () => { await retained.validate(); });
      expect(validationMap.get('pane')).toBe(true);
      act(() => { wrapper.setProps(render(replacement).props); });
      await act(async () => { await replacement.validate(); });
      expect(validationMap.get('pane')).toBe(false);
      act(() => { replacement.reset(); });
      expect(validationMap.get('pane')).toBe(true);
    } finally {
      wrapper.unmount();
    }
    await act(async () => {
      await first.validate();
      await retained.validate();
      await replacement.validate();
    });
    expect(validationMap.get('pane')).toBe(true);
  });
});
