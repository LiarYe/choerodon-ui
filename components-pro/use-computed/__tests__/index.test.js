import React from 'react';
import { mount } from 'enzyme';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import useComputed from '../index';

it('updates observable dependencies and replaces closures when inputs change', () => {
  const state = observable({ value: 2 });
  let renders = 0;
  const View = observer(({ multiplier }) => {
    renders += 1;
    const value = useComputed(() => state.value * multiplier, [multiplier]);
    return <span>{value}</span>;
  });
  const wrapper = mount(<View multiplier={3} />);
  expect(wrapper.text()).toBe('6');
  runInAction(() => { state.value = 4; });
  expect(wrapper.text()).toBe('12');
  wrapper.setProps({ multiplier: 5 });
  expect(wrapper.text()).toBe('20');
  wrapper.unmount();
  const count = renders;
  runInAction(() => { state.value = 6; });
  expect(renders).toBe(count);
});
