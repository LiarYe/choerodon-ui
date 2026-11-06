import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { autorun, isAction, isObservable, isObservableArray, runInAction } from 'mobx';
import PerformanceTableProfessionalBar from '../query-bar/TableProfessionalBar';
import TableProfessionalBar from '../../table/query-bar/TableProfessionalBar';
import PerformanceTableContext from '../TableContext';
import TableContext from '../../table/TableContext';
import DataSet from '../../data-set';
import Select from '../../select';

describe.each([
  ['PerformanceTable', PerformanceTableProfessionalBar, PerformanceTableContext],
  ['Table', TableProfessionalBar, TableContext],
])('%s professional query bar React element storage', (_, Bar, Context) => {
  const createBar = (props = {}) => new Bar({ queryFields: [], dataSet: {}, buttons: [], ...props }, { tableStore: {} });

  it('preserves observer component identity and observes replacement and array mutations', () => {
    const onEnterDown = jest.fn();
    const field = <Select key='status' name='status' onEnterDown={onEnterDown} />;
    const bar = createBar();
    const lengths = [];
    const dispose = autorun(() => lengths.push(bar.moreFields ? bar.moreFields.length : 0));
    try {
      bar.openMore([field]);
      expect(isObservableArray(bar.moreFields)).toBe(true);
      expect(bar.moreFields[0]).toBe(field);
      expect(bar.moreFields[0].type).toBe(Select);
      expect(isAction(bar.moreFields[0].type)).toBe(false);
      expect(isObservable(bar.moreFields[0])).toBe(false);
      expect(bar.moreFields[0].props.onEnterDown).toBe(onEnterDown);
      runInAction(() => bar.moreFields.push(field));
      bar.openMore([field]);
      bar.openMore([field]);
      expect(lengths).toEqual([0, 1, 2, 0, 1]);
    } finally {
      dispose();
    }
  });

  it('expands on failed validation and preserves injected and existing enter handlers', async () => {
    const onEnterDown = jest.fn();
    const bar = createBar({ queryFieldsLimit: 0, queryFields: [<Select key='first' />, <Select key='second' onEnterDown={onEnterDown} />] });
    await bar.handleDataSetValidate({ result: Promise.resolve(true) });
    expect(bar.moreFields).toBeUndefined();
    await bar.handleDataSetValidate({ result: Promise.resolve(false) });
    expect(bar.moreFields[0].type).toBe(Select);
    expect(bar.moreFields[0].props.onEnterDown).toBe(bar.handleFieldEnter);
    expect(bar.moreFields[1]).toBe(bar.props.queryFields[1]);
    expect(bar.moreFields[1].props.onEnterDown).toBe(onEnterDown);
  });

  it.each([false, true])('renders observer Select fields and updates expansion with defaultExpanded=%s', defaultExpanded => {
    const queryDataSet = new DataSet({ autoCreate: true, fields: [{ name: 'status' }] });
    const field = <Select key='status' name='status' />;
    const wrapper = mount(
      <Context.Provider value={{ tableStore: {} }}>
        <Bar dataSet={new DataSet()} queryDataSet={queryDataSet} queryFields={[<span key='visible' />, field]} queryFieldsLimit={1} buttons={[]} defaultExpanded={defaultExpanded} />
      </Context.Provider>,
    );
    try {
      const bar = wrapper.find(Bar).instance();
      expect(wrapper.find(Select).length).toBe(defaultExpanded ? 1 : 0);
      act(() => { bar.openMore(bar.createFields([field])); });
      wrapper.update();
      expect(wrapper.find(Select).length).toBe(defaultExpanded ? 0 : 1);
      act(() => { bar.openMore(bar.createFields([field])); });
      wrapper.update();
      expect(wrapper.find(Select).length).toBe(defaultExpanded ? 1 : 0);
    } finally {
      wrapper.unmount();
    }
  });
});
