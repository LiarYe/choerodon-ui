import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import warning from 'choerodon-ui/lib/_util/warning';
import CardCommand from '../CardCommand';

jest.mock('choerodon-ui/lib/_util/warning', () => jest.fn());

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('CardCommand rejected renderer lifecycle', () => {
  let wrapper;
  beforeEach(() => warning.mockClear());
  afterEach(() => {
    if (wrapper) wrapper.unmount();
    wrapper = undefined;
  });

  const mountPending = async pending => {
    await act(async () => {
      wrapper = mount(<CardCommand prefixCls="card" buttonDisplay="limit" record={{ id: 1 }} dataSet={{}} renderCommand={() => pending.promise} />);
    });
  };

  it('reports a current rejection and recovers on the next renderer', async () => {
    const pending = deferred();
    await mountPending(pending);
    await act(async () => { pending.reject(new Error('renderer failed')); });
    wrapper.update();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(false, 'renderer failed');
    expect(wrapper.find('button')).toHaveLength(0);
    expect(wrapper.text()).toBe('');
    await act(async () => { wrapper.setProps({ renderCommand: () => [{ children: 'recovered' }] }); });
    wrapper.update();
    expect(wrapper.text()).toContain('recovered');
  });

  it('consumes an obsolete rejection without changing the newer result or reporting it', async () => {
    const older = deferred();
    const newer = deferred();
    await mountPending(older);
    await act(async () => { wrapper.setProps({ renderCommand: () => newer.promise }); });
    await act(async () => { newer.resolve([{ children: 'newer' }]); });
    await act(async () => { older.reject(new Error('obsolete')); });
    wrapper.update();
    expect(wrapper.text()).toContain('newer');
    expect(warning).not.toHaveBeenCalled();
  });

  it('consumes a rejection after unmount without reporting or updating state', async () => {
    const pending = deferred();
    await mountPending(pending);
    wrapper.unmount();
    wrapper = undefined;
    const error = jest.spyOn(console, 'error');
    try {
      await act(async () => { pending.reject(new Error('unmounted')); });
      expect(warning).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
