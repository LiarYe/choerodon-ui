import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { isAction, isComputedProp } from 'mobx';
import Lov from '../Lov';
import DataSet from '../../data-set';

describe('Lov migration semantics', () => {
  it('inherits cached options and bound handlers while updating fields and props', () => {
    const first = new DataSet({ data: [{ value: 'a', meaning: 'Alpha' }] });
    const second = new DataSet({ data: [{ value: 'b', meaning: 'Beta' }] });
    const dataSet = new DataSet({
      fields: [{ name: 'first', options: first }, { name: 'second', options: second }],
      data: [{ first: 'a', second: 'b' }],
    });
    const onSearchMatcherChange = jest.fn();
    const wrapper = mount(<Lov dataSet={dataSet} name="first" onSearchMatcherChange={onSearchMatcherChange} />);
    const instance = wrapper.instance();
    try {
      expect(isComputedProp(instance, 'options')).toBe(true);
      expect(instance.options).toBe(first);
      expect(instance.options).toBe(instance.options);
      const { handleSearchMatcherChange, saveSuffixRef } = instance;
      expect(isAction(handleSearchMatcherChange)).toBe(true);
      expect(isAction(instance.setText)).toBe(true);
      expect(isAction(saveSuffixRef)).toBe(true);
      act(() => { handleSearchMatcherChange('meaning'); });
      expect(onSearchMatcherChange).toHaveBeenCalledWith('meaning');
      expect(instance.searchMatcher).toBe('meaning');
      act(() => { instance.setText('Alpha'); });
      expect(instance.searching).toBe(true);
      act(() => { instance.setText(''); });
      expect(instance.searching).toBe(false);
      const suffix = document.createElement('span');
      act(() => { saveSuffixRef(suffix); });
      expect(instance.suffixRef).toBe(suffix);
      wrapper.setProps({ name: 'second', mode: 'button', readOnly: true });
      expect(instance.options).toBe(second);
      expect(instance.getValue()).toBe('b');
      expect(instance.readOnly).toBe(true);
      expect(wrapper.find('button').length).toBeGreaterThan(0);
      wrapper.setProps({ mode: undefined, readOnly: false });
      expect(instance.readOnly).toBe(false);
      expect(wrapper.find('input[type="text"]').length).toBe(1);
    } finally {
      wrapper.unmount();
    }
  });
});
