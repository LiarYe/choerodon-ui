import React from 'react';
import { mount } from 'enzyme';
import { observable, runInAction } from 'mobx';
import Cascader from '..';
import DataSet from '../../data-set';

describe('Cascader migration mounting', () => {
  it('refreshes mutated plain options on parent updates without rebuilding unchanged options', () => {
    const options = [{ value: 'root', meaning: 'Root', children: [{ value: 'child', meaning: 'Child' }] }];
    const wrapper = mount(<Cascader options={options} value={['root', 'child']} />);
    try {
      const instance = wrapper.instance();
      const first = instance.options;
      expect(wrapper.find('input').last().prop('value')).toBe('Root/Child');
      wrapper.setProps({ disabled: true });
      expect(instance.options).toBe(first);
      options[0].children[0].meaning = 'Updated';
      wrapper.setProps({ options });
      expect(instance.options.get(1).get('meaning')).toBe('Updated');
      expect(wrapper.find('input').last().prop('value')).toBe('Root/Updated');
      expect(options[0].children[0]).not.toHaveProperty('parentValue');
    } finally {
      wrapper.unmount();
    }
  });

  it('tracks nested observable additions and preserves supplied DataSet identity', () => {
    const options = observable([{ value: 'root', meaning: 'Root', children: [] }]);
    const wrapper = mount(<Cascader options={options} />);
    try {
      const instance = wrapper.instance();
      const first = instance.options;
      runInAction(() => options[0].children.push({ value: 'child', meaning: 'Child' }));
      expect(instance.options).not.toBe(first);
      expect(instance.options.get(1).parent).toBe(instance.options.get(0));
      const dataSet = new DataSet({ data: [{ value: 'external', meaning: 'External' }] });
      wrapper.setProps({ options: dataSet });
      expect(instance.options).toBe(dataSet);
      wrapper.setProps({ multiple: true });
      expect(instance.options).toBe(dataSet);
      wrapper.setProps({ options: undefined });
      expect(instance.options).toBe(instance.defaultOptions);
    } finally {
      wrapper.unmount();
    }
  });
});
