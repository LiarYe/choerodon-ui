import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { getObserverTree, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import TextArea from '../TextArea';
import TextAreaEntry from '..';
import IntlField from '../../intl-field';
import IntlFieldClass from '../../intl-field/IntlField';
import Mentions from '../../mentions';
import MentionsClass from '../../mentions/Mentions';
import * as Pro from '../../index';

describe('TextArea observer inheritance', () => {
  it('preserves constructor, prototype, static and entry identities', () => {
    expect(TextAreaEntry).toBe(TextArea);
    expect(Pro.TextArea).toBe(TextArea);
    expect(Pro.IntlField).toBe(IntlFieldClass);
    expect(Pro.Mentions).toBe(MentionsClass);
    expect(IntlField).toBe(IntlFieldClass);
    expect(Mentions).toBe(MentionsClass);
    expect(TextArea.name).toBe('TextArea');
    expect(TextArea.displayName).toBe('TextArea');
    expect(Object.hasOwnProperty.call(TextArea, 'defaultProps')).toBe(true);
    expect(Object.hasOwnProperty.call(TextArea, '__PRO_TEXTAREA')).toBe(true);
    expect(TextArea.defaultProps.suffixCls).toBe('textarea');
    [IntlField, Mentions].forEach(Component => {
      expect(Object.getPrototypeOf(Component)).toBe(TextArea);
      expect(Object.getPrototypeOf(Component.prototype)).toBe(TextArea.prototype);
      expect(Component.__PRO_TEXTAREA).toBe(true);
      expect(Component.prototype.render).toBe(TextArea.prototype.render);
    });
    expect(IntlField.defaultProps.rows).toBe(3);
    expect(Mentions.defaultProps.rows).toBe(1);
    expect(Mentions.Option).toBeDefined();
    expect(Mentions.getMentions('@alice')).toEqual([{ mentionsKey: '@', value: 'alice' }]);
    class DuplicateObserver extends TextArea {}
    expect(() => observer(DuplicateObserver)).toThrow(/already been declared/);
  });

  it.each([TextArea, IntlField, Mentions])('reacts to inherited state and disposes %p', Component => {
    const wrapper = mount(<Component defaultValue="hello" />);
    const instance = wrapper.instance();
    const forceUpdate = jest.spyOn(instance, 'forceUpdate');
    try {
      expect(instance).toBeInstanceOf(TextArea);
      expect(instance).toBeInstanceOf(Component);
      expect(instance.constructor).toBe(Component);
      expect(getObserverTree(instance, 'text').observers.length).toBeGreaterThan(0);
      act(() => {
        runInAction(() => { instance.text = 'changed'; });
      });
      expect(wrapper.getDOMNode().querySelector('input, textarea').value).toBe('changed');
      expect(forceUpdate).toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
    expect(getObserverTree(instance, 'text').observers || []).toHaveLength(0);
    forceUpdate.mockClear();
    act(() => {
      runInAction(() => { instance.text = 'after unmount'; });
    });
    expect(forceUpdate).not.toHaveBeenCalled();
  });

  it('preserves IntlField prefixes after prop updates and mode changes', () => {
    const wrapper = mount(<IntlField />);
    try {
      wrapper.setProps({ readOnly: true });
      expect(wrapper.find('input').prop('readOnly')).toBe(true);
      expect(wrapper.find('.c7n-pro-input-suffix')).toHaveLength(1);
      wrapper.setProps({ readOnly: false, type: 'multipleLine' });
      expect(wrapper.find('textarea.c7n-pro-textarea')).toHaveLength(1);
      wrapper.setProps({ displayOutput: true });
      expect(wrapper.instance().prefixCls).toBe('c7n-pro-output');
      wrapper.setProps({ displayOutput: false, type: 'singleLine' });
      expect(wrapper.find('input.c7n-pro-input')).toHaveLength(1);
      expect(wrapper.find('.c7n-pro-input-suffix')).toHaveLength(1);
      wrapper.setProps({ prefixCls: 'custom-intl' });
      expect(wrapper.instance().prefixCls).toBe('custom-intl');
      wrapper.setProps({ prefixCls: undefined });
      expect(wrapper.find('.c7n-pro-input-suffix')).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
  });

  it('tracks IntlField own loading state and runs inherited cleanup', () => {
    const wrapper = mount(<IntlField />);
    const instance = wrapper.instance();
    const close = jest.fn();
    const removeListener = jest.spyOn(window, 'removeEventListener');
    try {
      expect(wrapper.getDOMNode().querySelector('.c7n-progress')).toBeNull();
      act(() => { instance.setLoading(true); });
      expect(wrapper.getDOMNode().querySelector('.c7n-progress')).not.toBeNull();
      expect(getObserverTree(instance, 'loading').observers.length).toBeGreaterThan(0);
      instance.modal = { close };
    } finally {
      wrapper.unmount();
    }
    expect(close).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith('resize', instance.handleWindowResize, false);
    removeListener.mockRestore();
    expect(getObserverTree(instance, 'loading').observers || []).toHaveLength(0);
  });

  it('tracks Mentions own measuring state and releases its subscription', () => {
    const wrapper = mount(<Mentions defaultValue="@alice" />);
    const instance = wrapper.instance();
    try {
      expect(wrapper.getDOMNode().querySelector('.c7n-pro-mentions-measure')).toBeNull();
      act(() => {
        runInAction(() => {
          instance.measurePrefix = '@';
          instance.measuring = true;
        });
      });
      expect(wrapper.getDOMNode().querySelector('.c7n-pro-mentions-measure')).not.toBeNull();
      expect(getObserverTree(instance, 'measuring').observers.length).toBeGreaterThan(0);
      act(() => { instance.stopMeasure(); });
      expect(wrapper.getDOMNode().querySelector('.c7n-pro-mentions-measure')).toBeNull();
    } finally {
      wrapper.unmount();
    }
    expect(getObserverTree(instance, 'measuring').observers || []).toHaveLength(0);
  });
});
