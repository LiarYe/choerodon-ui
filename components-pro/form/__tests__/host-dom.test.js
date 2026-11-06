import React from 'react';
import { mount } from 'enzyme';
import Form from '..';
import DataSet from '../../data-set';
import TextField from '../../text-field';
import NumberField from '../../number-field';
import Password from '../../password';
import EmailField from '../../email-field';

describe('Form host DOM', () => {
  let wrapper;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('preserves field values and toggles disabled and colon state on host elements', () => {
    const dataSet = new DataSet({
      data: [{ phone: '1800000000', age: 18, email: 'xxx@choerodon.io' }],
      fields: [
        { name: 'phone', label: '手机号' },
        { name: 'password', label: '密码' },
        { name: 'age', type: 'number', label: '年龄' },
        { name: 'email', type: 'email', label: '邮箱' },
      ],
    });
    const record = dataSet.current;
    const original = record.toData();
    wrapper = mount(
      <Form dataSet={dataSet} disabled useColon>
        <TextField name="phone" />
        <Password name="password" />
        <NumberField name="age" />
        <EmailField name="email" />
      </Form>,
    );
    jest.runAllTimers();
    const host = wrapper.getDOMNode();
    const inputs = () => Array.from(host.querySelectorAll('input[name]:not([type="hidden"])'));
    expect(host.querySelectorAll('input')).toHaveLength(5);
    expect(host.querySelectorAll('input.c7n-pro-password-fix-autofill')).toHaveLength(1);
    expect(inputs()).toHaveLength(4);
    expect(inputs().map(input => input.value)).toEqual(['1800000000', '', '18', 'xxx@choerodon.io']);
    expect(inputs().every(input => input.disabled)).toBe(true);
    expect(host.querySelectorAll('td.c7n-pro-field-label-useColon')).toHaveLength(4);
    wrapper.setProps({ disabled: false, useColon: false });
    expect(inputs().every(input => !input.disabled)).toBe(true);
    expect(host.querySelectorAll('.c7n-pro-field-label-useColon')).toHaveLength(0);
    wrapper.setProps({ disabled: true, useColon: true });
    expect(inputs().every(input => input.disabled)).toBe(true);
    expect(host.querySelectorAll('td.c7n-pro-field-label-useColon')).toHaveLength(4);
    expect(dataSet.current).toBe(record);
    expect(record.toData()).toEqual(original);
  });
});
