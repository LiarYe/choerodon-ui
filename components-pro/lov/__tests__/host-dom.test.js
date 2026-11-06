import React from 'react';
import { mount } from 'enzyme';
import Lov from '..';
import DataSet from '../../data-set';

describe('Lov host DOM', () => {
  let wrapper;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the empty editable input and search affordance', () => {
    wrapper = mount(<Lov />);
    const host = wrapper.getDOMNode();
    const input = host.querySelector('input[type="text"]');
    expect(input.value).toBe('');
    expect(input.readOnly).toBe(false);
    expect(input.disabled).toBe(false);
    expect(host.querySelectorAll('input[type="hidden"]')).toHaveLength(1);
    expect(host.querySelectorAll('.icon-search')).toHaveLength(1);
    expect(host.classList.contains('c7n-pro-select-lov')).toBe(true);
  });

  it('renders two buttons without changing records and preserves bound object values', () => {
    const dataSet = new DataSet({
      autoCreate: true,
      fields: [
        { name: 'code', textField: 'code', type: 'object', lovCode: 'LOV_CODE', lovPara: { code: '111' }, required: true },
        { name: 'code_code', type: 'string', bind: 'code.code' },
        { name: 'code_description', type: 'string', bind: 'code.description' },
      ],
    });
    const record = dataSet.current;
    const before = record.toData();
    wrapper = mount(<Lov dataSet={dataSet} name="code" mode="button" />);
    expect(wrapper.find('button').hostNodes()).toHaveLength(2);
    expect(wrapper.find('button').hostNodes().map(button => button.getDOMNode().tagName)).toEqual(['BUTTON', 'BUTTON']);
    expect(dataSet.records).toHaveLength(1);
    expect(record.toData()).toEqual(before);
    record.set('code', { code: 'A', description: 'Alpha' });
    wrapper.update();
    expect(record.get('code_code')).toBe('A');
    expect(record.get('code_description')).toBe('Alpha');
    expect(record.toData().code).toEqual({ code: 'A', description: 'Alpha' });
    expect(wrapper.find('button').hostNodes()).toHaveLength(2);
    expect(dataSet.current).toBe(record);
  });
});
