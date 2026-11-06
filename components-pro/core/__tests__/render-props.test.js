import React from 'react';
import { mount } from 'enzyme';
import { runInAction } from 'mobx';
import C7nSkeleton from 'choerodon-ui/lib/skeleton';
import C7nAvatar from 'choerodon-ui/lib/skeleton/Avatar';
import C7nButton from 'choerodon-ui/lib/skeleton/Button';
import C7nInput from 'choerodon-ui/lib/skeleton/Input';
import C7nSpin from 'choerodon-ui/lib/spin';
import Skeleton from '../../skeleton';
import Spin from '../../spin';
import Typography from '../../typography';
import DataSet from '../../data-set';

describe('render-only props', () => {
  it.each([
    [Skeleton, C7nSkeleton],
    [Skeleton.Avatar, C7nAvatar],
    [Skeleton.Button, C7nButton],
    [Skeleton.Input, C7nInput],
    [Spin, C7nSpin],
  ])('forwards current props through %p', (Component, BaseComponent) => {
    const wrapper = mount(<Component className="first" />);
    expect(wrapper.find(BaseComponent).prop('className')).toBe('first');
    wrapper.setProps({ className: 'second' });
    expect(wrapper.find(BaseComponent).prop('className')).toBe('second');
    wrapper.unmount();
  });

  it.each([
    [Skeleton, C7nSkeleton, 'loading'],
    [Spin, C7nSpin, 'spinning'],
  ])('tracks observable dataset status through %p', (Component, BaseComponent, prop) => {
    const dataSet = new DataSet();
    const wrapper = mount(<Component dataSet={dataSet} {...{ [prop]: false }} />);
    expect(wrapper.find(BaseComponent).prop(prop)).toBe(false);
    runInAction(() => { dataSet.status = 'loading'; });
    wrapper.update();
    expect(wrapper.find(BaseComponent).prop(prop)).toBe(true);
    wrapper.setProps({ dataSet: undefined });
    expect(wrapper.find(BaseComponent).prop(prop)).toBe(false);
    wrapper.unmount();
  });

  it.each([
    Typography.Text,
    Typography.Link,
    Typography.Title,
    Typography.Paragraph,
  ])('renders updated children through %p', Component => {
    const wrapper = mount(<Component>first</Component>);
    expect(wrapper.text()).toContain('first');
    wrapper.setProps({ children: 'second' });
    expect(wrapper.text()).toContain('second');
    expect(wrapper.text()).not.toContain('first');
    wrapper.unmount();
  });
});
