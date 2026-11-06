import React from 'react';
import { mount } from 'enzyme';
import { isAction, isObservableProp, runInAction } from 'mobx';
import TextField from '../../text-field';
import Select from '../../select';
import CheckBox from '../../check-box';
import AutoComplete from '../../auto-complete';
import ScreeningItem from '../../screening/ScreeningItem';
import Table from '../../table';
import DataSet from '../../data-set';
import FormContext from '../../form/FormContext';

describe('MobX component migration', () => {
  it('updates context without retaining removed props or records', () => {
    const first = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'first' }] });
    const second = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'second' }] });
    const context = FormContext._currentValue;
    const wrapper = mount(<FormContext.Provider value={{ ...context, disabled: false }}><TextField dataSet={first} name="name" /></FormContext.Provider>);
    expect(wrapper.find('input').prop('value')).toBe('first');
    wrapper.setProps({ value: { ...context, disabled: true }, children: <TextField dataSet={second} name="name" /> });
    expect(wrapper.find('input').prop('value')).toBe('second');
    expect(wrapper.find('input').prop('disabled')).toBe(true);
    wrapper.setProps({ value: { ...context, disabled: false }, children: <TextField name="name" /> });
    expect(wrapper.find('input').prop('value')).not.toBe('second');
    expect(wrapper.find('input').prop('disabled')).toBe(false);
    wrapper.unmount();
  });

  it('keeps inherited actions bound and controlled values current', () => {
    const wrapper = mount(<TextField value="first" />);
    const instance = wrapper.instance();
    expect(isObservableProp(instance, 'isFocused')).toBe(true);
    expect(isObservableProp(instance, 'text')).toBe(true);
    expect(isAction(instance.setValue)).toBe(true);
    const focus = instance.handleFocus;
    focus({});
    expect(instance.isFocused).toBe(true);
    wrapper.setProps({ value: 'second', disabled: true });
    expect(wrapper.find('input').prop('value')).toBe('second');
    expect(instance.disabled).toBe(true);
    wrapper.setProps({ disabled: undefined });
    expect(instance.disabled).toBe(false);
    wrapper.unmount();
  });

  it('inherits checkbox actions and preserves default checked initialization', () => {
    const wrapper = mount(<CheckBox defaultChecked value="yes" unCheckedValue="no" />);
    const instance = wrapper.instance();
    expect(isAction(instance.setValue)).toBe(true);
    expect(isAction(instance.setChecked)).toBe(true);
    expect(instance.value).toBe('yes');
    instance.setChecked(false);
    expect(instance.value).toBe('no');
    instance.setChecked(true);
    expect(instance.value).toBe('yes');
    wrapper.unmount();
  });

  it('inherits bound autocomplete actions and executes overridden handlers', () => {
    const wrapper = mount(<AutoComplete />);
    const instance = wrapper.instance();
    const { handleChange, handleFocus } = instance;
    expect(isAction(handleChange)).toBe(true);
    expect(isAction(handleFocus)).toBe(true);
    instance.isChoose = true;
    handleChange({ target: { value: 'typed' } });
    expect(instance.isChoose).toBe(false);
    expect(instance.text).toBe('typed');
    handleFocus({ target: { value: 'focused' } });
    expect(instance.inputText).toBe('focused');
    expect(instance.isFocused).toBe(true);
    wrapper.unmount();
  });

  it('caches screening options and invalidates them when children or selection mode change', () => {
    const wrapper = mount(<ScreeningItem name="filter" onConfirm={jest.fn()}><Select.Option value="a">A</Select.Option></ScreeningItem>);
    const instance = wrapper.instance();
    const options = instance.options;
    expect(options).toBe(instance.options);
    expect(options.get(0).get('value')).toBe('a');
    wrapper.setProps({ children: <Select.Option value="b">B</Select.Option> });
    const nextOptions = instance.options;
    expect(nextOptions).not.toBe(options);
    expect(nextOptions).toBe(instance.options);
    expect(nextOptions.get(0).get('value')).toBe('b');
    instance.handleMultiple();
    expect(instance.options.selection).toBe('multiple');
    expect(instance.options).not.toBe(nextOptions);
    expect(instance.options).toBe(instance.options);
    const suppliedOptions = new DataSet({ data: [{ value: 'supplied' }] });
    wrapper.setProps({ options: suppliedOptions });
    expect(instance.options).toBe(suppliedOptions);
    wrapper.setProps({ options: undefined });
    expect(instance.options.get(0).get('value')).toBe('b');
    wrapper.unmount();
  });

  it('retains option identity and disposes committed subscriptions', () => {
    const wrapper = mount(<Select><Select.Option value="a">A</Select.Option><Select.Option value="b">B</Select.Option></Select>);
    const instance = wrapper.instance();
    expect(instance.options.length).toBe(2);
    expect(instance.options).toBe(instance.options);
    expect(instance.checkValueReaction).toBeDefined();
    wrapper.setProps({ children: <Select.Option value="c">C</Select.Option> });
    expect(instance.options.length).toBe(1);
    expect(instance.options.get(0).get('value')).toBe('c');
    wrapper.unmount();
    expect(instance.checkValueReaction).toBeUndefined();
  });

  it('renders observable table columns and record updates', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name', type: 'string' }], data: [{ name: 'first' }] });
    const wrapper = mount(<Table dataSet={dataSet} columns={[{ name: 'name', width: 100 }]} queryBar="none" />);
    expect(wrapper.text()).toContain('first');
    runInAction(() => dataSet.current.set('name', 'second'));
    wrapper.update();
    expect(wrapper.text()).toContain('second');
    wrapper.unmount();
  });
});
