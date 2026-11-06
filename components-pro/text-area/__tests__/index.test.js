import React from 'react';
import { mount } from 'enzyme';
import TextArea from '..';
import TextAreaTest from './textAreaTest';

describe('TextArea-pro', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders TextArea-pro correctly', () => {
    const wrapper = mount(<TextArea />);
    expect(wrapper).toMatchSnapshot();
  });

  it('TextArea should have the default resize and rows', () => {
    const wrapper = mount(<TextArea />);
    expect(wrapper.find('textarea').prop('style').resize).toBe('none');
    expect(wrapper.find('textarea').prop('rows')).toBe(4);
    wrapper.unmount();
  });

  it('updates rows and resize and restores defaults when props are removed', () => {
    const wrapper = mount(<TextArea rows={7} resize="vertical" />);
    expect(wrapper.find('textarea').prop('rows')).toBe(7);
    expect(wrapper.find('textarea').prop('style').resize).toBe('vertical');
    wrapper.setProps({ rows: 2, resize: 'horizontal' });
    expect(wrapper.find('textarea').prop('rows')).toBe(2);
    expect(wrapper.find('textarea').prop('style').resize).toBe('horizontal');
    wrapper.setProps({ rows: undefined, resize: undefined });
    expect(wrapper.find('textarea').prop('rows')).toBe(4);
    expect(wrapper.find('textarea').prop('style').resize).toBe('none');
    wrapper.unmount();
  });

  it('uses autoSize minRows and disables resize for a fixed row range', () => {
    const wrapper = mount(<TextArea autoSize={{ minRows: 3, maxRows: 3 }} resize="both" />);
    expect(wrapper.find('textarea').prop('rows')).toBe(3);
    expect(wrapper.find('textarea').prop('style').resize).toBe('none');
    wrapper.setProps({ autoSize: false, resize: 'vertical' });
    expect(wrapper.find('textarea').prop('rows')).toBe(4);
    expect(wrapper.find('textarea').prop('style').resize).toBe('vertical');
    wrapper.unmount();
  });

  it('TextArea have the disabled property and default false', () => {
    const wrapper = mount(<TextArea />);
    expect(wrapper.find('.c7n-pro-textarea-disabled')).toHaveLength(0);
    wrapper.setProps({ disabled: true });
    wrapper.update();
    expect(wrapper.find('.c7n-pro-textarea-disabled')).toHaveLength(1);
  });

  it('can not click or input when the readOnly true and default false', () => {
    const handleChange = jest.fn();
    const wrapper = mount(<TextArea onChange={handleChange} />);
    expect(wrapper.prop('readOnly')).toBe(false);
    wrapper.setProps({ readOnly: true });
    wrapper.update();
    expect(wrapper.prop('readOnly')).toBe(true);

    wrapper.find('textarea').simulate('change');
    jest.runAllTimers();
    wrapper.update();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('the value will be controlled and the change event trigger when the value change', () => {
    const handleChange = jest.fn();
    const wrapper = mount(<TextArea value="text" onChange={handleChange} />);
    expect(
      wrapper
        .find('textarea')
        .at(0)
        .prop('value'),
    ).toBe('text');
    wrapper.setProps({ value: 'text-area' });
    wrapper.update();
    expect(
      wrapper
        .find('textarea')
        .at(0)
        .prop('value'),
    ).toBe('text-area');
  });

  it('the dataSet should renders correctly', () => {
    const wrapper = mount(<TextAreaTest />);
    expect(wrapper.find('TextArea').props().name).toEqual('content');
    expect(wrapper).toMatchSnapshot();
  });
});
