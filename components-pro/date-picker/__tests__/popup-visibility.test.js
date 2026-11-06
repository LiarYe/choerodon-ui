import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import moment from 'moment';
import MonthsPicker from '../../month-picker';

describe('month picker popup visibility monitoring', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['detached, zero size', false, 0, true],
    ['detached, visible size', false, 120, true],
    ['attached, zero size', true, 0, true],
    ['attached, visible size', true, 120, false],
  ])('%s', (name, attached, width, closes) => {
    const container = document.createElement('div');
    if (attached) document.body.appendChild(container);
    const onPopupHiddenChange = jest.fn();
    const wrapper = mount(
      <MonthsPicker min={moment('2021-01-01')} onPopupHiddenChange={onPopupHiddenChange} />,
      { attachTo: container },
    );
    const instance = wrapper.instance();
    const trigger = instance.trigger;
    const node = trigger.domNode;
    Object.defineProperty(node, 'offsetWidth', { configurable: true, value: width });
    Object.defineProperty(node, 'offsetHeight', { configurable: true, value: width ? 32 : 0 });
    const setHidden = jest.spyOn(trigger, 'setPopupHidden');
    try {
      expect(node.isConnected).toBe(attached);
      act(() => {
        wrapper.find('.c7n-pro-calendar-picker-wrapper').simulate('click');
        jest.advanceTimersByTime(1000);
      });
      expect(instance.popup).toBe(false);
      expect(setHidden).not.toHaveBeenCalled();
      expect(onPopupHiddenChange).not.toHaveBeenCalled();
      act(() => {
        wrapper.find('input').simulate('focus');
        jest.advanceTimersByTime(149);
      });
      expect(instance.popup).toBe(false);
      act(() => { jest.advanceTimersByTime(1); });
      wrapper.update();
      expect(instance.popup).toBe(true);
      expect(onPopupHiddenChange.mock.calls).toEqual([[false]]);
      expect(setHidden.mock.calls).toEqual([[false]]);
      expect(wrapper.find('Popup').hasClass('c7n-pro-calendar-picker-popup')).toBe(true);
      act(() => { jest.advanceTimersByTime(499); });
      expect(instance.popup).toBe(true);
      act(() => { jest.advanceTimersByTime(1); });
      wrapper.update();
      expect(instance.popup).toBe(!closes);
      expect(setHidden.mock.calls).toEqual(closes ? [[false], [true]] : [[false]]);
      expect(onPopupHiddenChange.mock.calls).toEqual(closes ? [[false], [true]] : [[false]]);
      if (!closes) {
        act(() => { jest.advanceTimersByTime(1000); });
        expect(instance.popup).toBe(true);
        expect(wrapper.find('Popup').prop('hidden')).toBe(false);
      }
    } finally {
      wrapper.unmount();
      if (attached) document.body.removeChild(container);
      jest.clearAllTimers();
      jest.restoreAllMocks();
    }
  });
});
