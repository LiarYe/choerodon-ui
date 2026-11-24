import React from 'react';
import { mount } from 'enzyme';
import Lov from '..';
import DataSet from '../../data-set';

describe('Lov-pro', () => {
  it('render correctly', () => {
    const wrapper = mount(<Lov />);
    expect(wrapper.render()).toMatchSnapshot();
  });

  const ds = new DataSet({
    autoCreate: true,
    fields: [
      {
        name: 'code',
        textField: 'code',
        type: 'object',
        lovCode: 'LOV_CODE',
        lovPara: { code: '111' },
        required: true,
      },
      { name: 'code_code', type: 'string', bind: 'code.code' },
      { name: 'code_description', type: 'string', bind: 'code.description' },
    ],
  });

  it('keeps the button instance for focus and resolves its host for DOM operations', () => {
    const ref = React.createRef();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const wrapper = mount(<Lov ref={ref} dataSet={ds} name="code" mode="button" />, { attachTo: container });
    try {
      const button = container.querySelector('button');
      expect(ref.current.domNode).toBe(button);
      expect(ref.current.element).not.toBe(button);
      ref.current.focus();
      expect(document.activeElement).toBe(button);
      expect(button.classList.contains(`${ref.current.prefixCls}-focused`)).toBe(true);
      ref.current.blur();
      expect(button.classList.contains(`${ref.current.prefixCls}-focused`)).toBe(false);
    } finally {
      wrapper.unmount();
      container.remove();
    }
  });

  it('resolves the current group without overriding the popup alignment target', () => {
    const ref = React.createRef();
    const target = document.createElement('div');
    const wrapper = mount(<Lov ref={ref} addonAfter="after" getPopupAlignTarget={() => target} />);
    try {
      expect(ref.current.domNode).toBe(wrapper.getDOMNode());
      expect(ref.current.domNode).not.toBe(ref.current.wrapper);
      expect(ref.current.trigger.props.getRootDomNode()).toBe(target);
      wrapper.setProps({ addonAfter: undefined });
      expect(ref.current.domNode).toBe(ref.current.wrapper);
    } finally {
      wrapper.unmount();
    }
  });

  it('render mode button', () => {
    const wrapper = mount(<Lov dataSet={ds} name="code" mode="button" />);
    expect(wrapper.find('button').length).toBe(2);
    expect(wrapper).toMatchSnapshot();
  });
});
