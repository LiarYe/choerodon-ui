import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { configure, isAction, _getGlobalState } from 'mobx';
import Lov from '../Lov';
import DataSet from '../../data-set';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Lov action boundaries', () => {
  let wrapper;
  let warn;
  let enforceActions;

  beforeEach(() => {
    enforceActions = _getGlobalState().enforceActions;
    configure({ enforceActions: 'always' });
    warn = jest.spyOn(console, 'warn');
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    wrapper = undefined;
    const warnings = warn.mock.calls.filter(args => args.some(arg => /\[MobX\]/i.test(String(arg))));
    warn.mockRestore();
    configure({ enforceActions });
    if (warnings.length) {
      throw new Error(warnings.map(args => args.join(' ')).join('\n'));
    }
  });

  function mountLov(props = {}) {
    const options = new DataSet({ data: [{ value: 'a', meaning: 'Alpha' }] });
    const dataSet = new DataSet({
      fields: [{ name: 'code', options, valueField: 'value', textField: 'meaning' }],
      data: [{}],
    });
    wrapper = mount(<Lov dataSet={dataSet} name="code" {...props} />);
    return { instance: wrapper.instance(), options, dataSet };
  }

  it.each(['resolve', 'reject'])('clears searching after remote query %s', async outcome => {
    const { instance, options } = mountLov();
    const query = deferred();
    jest.spyOn(options, 'query').mockReturnValue(query.promise);
    expect(isAction(instance.setText)).toBe(true);
    expect(isAction(instance.searchRemote)).toBe(true);
    act(() => { instance.setText('Alpha'); });
    instance.doSearchDebounce.cancel();
    expect(instance.searching).toBe(true);
    expect(instance.loading).toBe(true);
    expect(instance.searchData(options.data)).toEqual([]);
    let pending;
    act(() => { pending = instance.searchRemote('Alpha'); });
    expect(options.queryParameter.meaning).toBe('Alpha');
    expect(options.query).toHaveBeenCalledWith(1, undefined, true);
    await act(async () => {
      if (outcome === 'reject') {
        const error = new Error('query failed');
        query.reject(error);
        await expect(pending).rejects.toBe(error);
      } else {
        query.resolve();
        await pending;
      }
    });
    expect(instance.searching).toBe(false);
    expect(instance.loading).toBe(false);
    expect(instance.searchData(options.data)).toEqual(options.data);
    act(() => { instance.setText(''); });
    expect(instance.searching).toBe(false);
  });

  it('clears popup search text when the popup closes', () => {
    const { instance } = mountLov({ viewMode: 'popup' });
    act(() => { instance.handlePopupSearch('Alpha'); });
    instance.doSearchDebounce.cancel();
    expect(instance.searchText).toBe('Alpha');
    instance.fetched = true;
    const { handlePopupHiddenChange } = instance;
    act(() => { handlePopupHiddenChange(true); });
    expect(instance.searchText).toBeUndefined();
    expect(instance.popup).toBe(false);
    expect(instance.fetched).toBeUndefined();
  });

  it('selects a single result only after query and options readiness', async () => {
    const { instance, options, dataSet } = mountLov({ autoSelectSingle: true });
    const query = deferred();
    const ready = deferred();
    jest.spyOn(options, 'query').mockReturnValue(query.promise);
    jest.spyOn(options, 'ready').mockReturnValue(ready.promise);
    let pending;
    act(() => { pending = instance.selectSingle(); });
    expect(dataSet.current.get('code')).toBeUndefined();
    await act(async () => {
      query.resolve();
      await pending;
    });
    expect(dataSet.current.get('code')).toBeUndefined();
    await act(async () => {
      ready.resolve();
      await ready.promise;
    });
    expect(dataSet.current.get('code')).toBe('a');
    expect(instance.searching).toBe(false);
  });

  it('selects a blur query result from its promise callback', async () => {
    const { instance, options, dataSet } = mountLov({ searchAction: 'blur' });
    const query = deferred();
    jest.spyOn(options, 'query').mockReturnValue(query.promise);
    act(() => { instance.syncValueOnBlur('Alpha'); });
    await act(async () => {
      query.resolve();
      await query.promise;
    });
    expect(dataSet.current.get('code')).toBe('a');
    expect(instance.searching).toBe(false);
  });

  it.each([false, true])('honors preventDefault=%s after awaiting a button callback', async prevented => {
    const click = deferred();
    const onClick = jest.fn(() => click.promise);
    const { instance, options, dataSet } = mountLov({ mode: 'button', autoSelectSingle: 'force', onClick });
    jest.spyOn(options, 'query').mockResolvedValue(undefined);
    const event = { isDefaultPrevented: () => prevented };
    let pending;
    act(() => { pending = instance.handleButtonClick(event); });
    expect(onClick).toHaveBeenCalledWith(event);
    expect(options.query).not.toHaveBeenCalled();
    await act(async () => {
      click.resolve();
      await pending;
      await options.ready();
    });
    expect(dataSet.current.get('code')).toBe(prevented ? undefined : 'a');
    expect(options.query).toHaveBeenCalledTimes(prevented ? 0 : 1);
  });

  it('restores paging and detail query state in the query finally callback', async () => {
    const { instance, options, dataSet } = mountLov({ readOnly: true, showDetailWhenReadonly: true });
    act(() => { dataSet.current.set('code', 'a'); });
    const query = deferred();
    jest.spyOn(options, 'query').mockReturnValue(query.promise);
    act(() => { instance.afterOpen(options); });
    expect(options.paging).toBe(false);
    expect(options.getState('__LOV_QUERY_STATE__')).toEqual({ lovQueryDetail: true });
    await act(async () => {
      query.resolve();
      await query.promise;
    });
    expect(options.paging).toBe(true);
    expect(options.getState('__LOV_QUERY_STATE__')).toBeUndefined();
  });
});
