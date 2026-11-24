import React from 'react';
import { mount } from 'enzyme';
import Transfer from '..';
import DataSet from '../../data-set';
import TransferTest from './transferTest';

describe('Transfer', () => {
  const handleDataSetChange = jest.fn();
  const optionData = [
    { text: 'Jack', value: 'jack' },
    { text: 'Huazhen', value: 'huazhen' },
    { text: 'Lucy', value: 'lucy' },
    { text: 'Niu', value: 'jiaqin' },
    { text: 'Shao', value: 'shao' },
  ];
  const data = [
    {
      'first-name': 'huazhen',
    },
  ];
  const optionDs = new DataSet({
    data: optionData,
    selection: 'single',
  });
  const ds = new DataSet({
    data,
    fields: [
      {
        name: 'first-name',
        type: 'string',
        label: '名',
        textField: 'text',
        valueField: 'value',
        options: optionDs,
      },
    ],
    events: {
      update: handleDataSetChange,
    },
  });
  it('Transfer render right Dom structure', () => {
    const wrapper = mount(<Transfer dataSet={ds} name="first-name" />);
    expect(wrapper.find('Select').length).toBe(2);
    expect(wrapper.find('TransferOperation').length).toBe(1);
  });

  it('styles the list root while delegating focus to the search input', () => {
    const wrapper = mount(<Transfer dataSet={ds} name="first-name" searchable />);
    try {
      const list = wrapper.find('Select').first();
      const root = list.getDOMNode();
      const input = list.find('input[type="text"]').first();
      const focused = `${list.instance().prefixCls}-focused`;
      const focus = jest.spyOn(input.getDOMNode(), 'focus');
      list.instance().focus();
      expect(focus).toHaveBeenCalled();
      input.simulate('focus');
      expect(root.classList.contains(focused)).toBe(true);
      input.simulate('blur');
      expect(root.classList.contains(focused)).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it('basic test render 6 input item ', () => {
    const wrapper = mount(<TransferTest />);
    expect(wrapper.find('input').length).toBe(6);
  });

  it('check all test  ', () => {
    const wrapper = mount(<Transfer dataSet={ds} name="first-name" />);
    wrapper
      .find('Checkbox')
      .at(0)
      .simulate('click');
    expect(
      wrapper
        .find('Checkbox')
        .at(1)
        .prop('checked'),
    ).toBe(true);
  });

  it('click option button ', () => {
    const wrapper = mount(<Transfer dataSet={ds} name="first-name" />);
    wrapper
      .find('Checkbox')
      .at(0)
      .simulate('click');
    expect(
      wrapper
        .find('Select')
        .at(1)
        .find('Checkbox').length,
    ).toBe(2);
    wrapper
      .find('Button')
      .at(1)
      .simulate('click');
    expect(
      wrapper
        .find('Select')
        .at(1)
        .find('Checkbox').length,
    ).toBe(4);
  });
});
