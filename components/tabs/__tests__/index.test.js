import React from 'react';
import { mount } from 'enzyme';
import Tabs from '..';
import Count from '../Count';

const { TabPane } = Tabs;

describe('Tabs', () => {
  it('initializes the ink bar callback before rendering tab counts', () => {
    const wrapper = mount(
      <Tabs>
        <TabPane tab="Counted tab" key="1" showCount count={() => 3}>
          Content
        </TabPane>
      </Tabs>,
    );
    expect(wrapper.find('.c7n-tabs-tab-count').text()).toBe('3');
    expect(wrapper.find(Count).prop('asyncCount')).toEqual(expect.any(Function));
    wrapper.unmount();
  });

  describe('editable-card', () => {
    let handleEdit;
    let wrapper;

    beforeEach(() => {
      handleEdit = jest.fn();
      wrapper = mount(
        <Tabs type="editable-card" onEdit={handleEdit}>
          <TabPane tab="foo" key="1">
            foo
          </TabPane>
        </Tabs>,
      );
    });

    it('add card', () => {
      wrapper
        .find('.c7n-tabs-new-tab')
        .hostNodes()
        .simulate('click');
      expect(handleEdit.mock.calls[0][1]).toBe('add');
    });

    it('remove card', () => {
      wrapper.find('.icon-close').simulate('click');
      expect(handleEdit).toHaveBeenCalledWith('1', 'remove');
    });
  });

  describe('tabPosition', () => {
    it('remove card', () => {
      const wrapper = mount(
        <Tabs tabPosition="left" tabBarExtraContent="xxx">
          <TabPane tab="foo" key="1">
            foo
          </TabPane>
        </Tabs>,
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
