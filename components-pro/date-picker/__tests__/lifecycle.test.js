import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import DatePicker from '../DatePicker';
import Form from '../../form';

it('unregisters from its Form and cancels inherited work on unmount', () => {
  jest.useFakeTimers();
  const wrapper = mount(<Form><DatePicker name="date" wait={100} waitType="debounce" /></Form>);
  const form = wrapper.instance();
  const instance = wrapper.find(DatePicker).instance();
  const cancelChange = jest.spyOn(instance.handleChangeWait, 'cancel');
  const cancelWarning = jest.spyOn(instance.showLengthExceedWarningDeb, 'cancel');
  const dispose = jest.spyOn(instance, 'disposer');
  const cursorTimeout = jest.fn();
  instance.timeID = setTimeout(cursorTimeout, 200);
  expect(form.getFields()).toContain(instance);
  try {
    act(() => { wrapper.setProps({ children: null }); });
    expect(form.getFields()).not.toContain(instance);
    expect(cancelChange).toHaveBeenCalledTimes(1);
    expect(cancelWarning).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    act(() => { jest.runOnlyPendingTimers(); });
    expect(cursorTimeout).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    jest.useRealTimers();
  }
});
