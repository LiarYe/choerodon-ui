import React from 'react';
import { mount } from 'enzyme';
import CodeArea from '../CodeArea';
import DataSet from '../../data-set';
import FormContext from '../../form/FormContext';

jest.mock('react-codemirror2', () => {
  const { forwardRef } = jest.requireActual('react');
  return {
    Controlled: forwardRef(({ value }, ref) => <textarea ref={ref} value={value || ''} readOnly />),
  };
});

describe('CodeArea subscription lifecycle', () => {
  const createDataSet = value => new DataSet({
    fields: [{ name: 'content', type: 'string' }],
    data: [{ content: value }],
  });

  it('does not subscribe or format in the constructor', () => {
    const dataSet = createDataSet('initial');
    const formatter = { getFormatted: jest.fn(value => value) };
    const instance = new CodeArea({ ...CodeArea.defaultProps, dataSet, name: 'content', formatter }, FormContext._currentValue);
    expect(instance.disposer).toBeUndefined();
    expect(formatter.getFormatted).not.toHaveBeenCalled();
    dataSet.current.set('content', 'uncommitted');
    expect(formatter.getFormatted).not.toHaveBeenCalled();
    expect(instance.text).toBeUndefined();
  });

  it('synchronizes controlled values, formatter changes and removed options after mount', () => {
    const formatter = { getFormatted: jest.fn((value, options) => `${options ? options.tabWidth : 'default'}:${value}`) };
    const nextFormatter = { getFormatted: jest.fn(value => `next:${value}`) };
    const wrapper = mount(<CodeArea value="initial" formatter={formatter} prettierOptions={{ tabWidth: 2 }} />);
    const instance = wrapper.instance();
    try {
      expect(wrapper.find('textarea').prop('value')).toBe('2:initial');
      wrapper.setProps({ value: 'updated' });
      expect(wrapper.find('textarea').prop('value')).toBe('2:updated');
      instance.midText = 'updated';
      wrapper.setProps({ prettierOptions: { tabWidth: 4 } });
      expect(wrapper.find('textarea').prop('value')).toBe('4:updated');
      wrapper.setProps({ prettierOptions: undefined });
      expect(wrapper.find('textarea').prop('value')).toBe('default:updated');
      wrapper.setProps({ formatter: nextFormatter });
      expect(wrapper.find('textarea').prop('value')).toBe('next:updated');
      wrapper.setProps({ formatter: undefined });
      expect(wrapper.find('textarea').prop('value')).toBe('updated');
      wrapper.setProps({ value: undefined });
      expect(wrapper.find('textarea').prop('value')).toBe('');
    } finally {
      wrapper.unmount();
    }
    expect(instance.disposer).toBeUndefined();
  });

  it('rebinds record values and releases subscriptions and parent form registration', () => {
    const first = createDataSet('first');
    const next = createDataSet('next');
    const formatter = { getFormatted: jest.fn(value => `formatted:${value}`) };
    const formNode = { addField: jest.fn(), removeField: jest.fn() };
    const context = { ...FormContext._currentValue, formNode };
    const wrapper = mount(<FormContext.Provider value={context}><CodeArea dataSet={first} name="content" formatter={formatter} /></FormContext.Provider>);
    const instance = wrapper.find(CodeArea).instance();
    try {
      expect(formNode.addField).toHaveBeenCalledWith(instance);
      expect(wrapper.find('textarea').prop('value')).toBe('formatted:first');
      instance.setText('local edit');
      first.current.set('content', 'external');
      wrapper.update();
      expect(wrapper.find('textarea').prop('value')).toBe('formatted:external');
      wrapper.setProps({ children: <CodeArea dataSet={next} name="content" formatter={formatter} /> });
      expect(wrapper.find('textarea').prop('value')).toBe('formatted:next');
      formatter.getFormatted.mockClear();
      first.current.set('content', 'detached');
      expect(formatter.getFormatted).not.toHaveBeenCalled();
      next.current.set('content', 'active');
      wrapper.update();
      expect(wrapper.find('textarea').prop('value')).toBe('formatted:active');
      formNode.removeField.mockClear();
      wrapper.unmount();
      expect(formNode.removeField).toHaveBeenCalledWith(instance);
      expect(instance.disposer).toBeUndefined();
      expect(instance.resizeObserver).toBeUndefined();
      expect(instance.secondTimeoutId).toBeUndefined();
      formatter.getFormatted.mockClear();
      next.current.set('content', 'after unmount');
      expect(formatter.getFormatted).not.toHaveBeenCalled();
      expect(instance.text).toBe('formatted:active');
    } finally {
      if (wrapper.exists()) wrapper.unmount();
    }
  });
});
