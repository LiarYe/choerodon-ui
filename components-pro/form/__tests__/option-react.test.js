import React from 'react';
import { mount } from 'enzyme';
import { isObservable } from 'mobx';
import { renderToStaticMarkup } from 'react-dom/server';
import Form from '..';
import NumberField from '../../number-field';
import SelectBox from '../../select-box';
import Option from '../../option/Option';
import OptGroup from '../../option/OptGroup';
import normalizeOptions from '../../option/normalizeOptions';
import { getConfig } from '../../../components/configure';

describe('Form option React nodes', () => {
  it('preserves component types and callbacks in option labels', () => {
    const onChange = jest.fn();
    const label = <NumberField value={3} onChange={onChange} />;
    const options = normalizeOptions({
      textField: 'meaning', valueField: 'value', disabledField: 'disabled',
      children: <Option value="size">{label}</Option>, getConfig,
    });
    const stored = options.get(0).get('meaning');
    expect(stored).toBe(label);
    expect(stored.type).toBe(NumberField);
    expect(stored.props.onChange).toBe(onChange);
    expect(renderToStaticMarkup(stored)).toContain('value="3"');
  });

  it('preserves group, explicit and implicit nodes through arrays and Fragments', () => {
    const callback = jest.fn();
    const types = [() => null, React.memo(() => null), React.forwardRef(() => null), React.lazy(() => Promise.resolve({ default: () => null }))];
    const nodes = types.map(type => React.createElement(type, { onClick: callback }));
    const group = <span>group</span>;
    const labels = [nodes[0], <React.Fragment key="label">{nodes[1]}</React.Fragment>];
    const options = normalizeOptions({
      textField: 'meaning', valueField: 'value', disabledField: 'disabled', getConfig,
      children: <React.Fragment><OptGroup label={group}>
        {nodes.map((node, index) => <Option key={index}>{node}</Option>)}
        <Option value={nodes[3]}>{labels}</Option>
        <Option value={0} disabled>{nodes[0]}</Option>
      </OptGroup></React.Fragment>,
    });
    nodes.forEach((node, index) => {
      const record = options.get(index);
      expect(record.get('meaning')).toBe(node);
      expect(record.get('value')).toBe(node);
      expect(record.get('group-0')).toBe(group);
      expect(record.get('meaning').type).toBe(types[index]);
      expect(record.get('meaning').props.onClick).toBe(callback);
      expect(isObservable(record.get('meaning'))).toBe(false);
    });
    expect(options.get(4).get('value')).toBe(nodes[3]);
    labels.forEach((label, index) => expect(options.get(4).get('meaning')[index]).toBe(label));
    expect(options.get(5).get('value')).toBe(0);
    expect(options.get(5).get('disabled')).toBe(true);
  });

  it('renders and updates a NumberField nested inside a Form SelectBox option', () => {
    const onChange = jest.fn();
    const render = value => (
      <Form><SelectBox><Option value="size"><NumberField value={value} onChange={onChange} /></Option></SelectBox></Form>
    );
    const wrapper = mount(render(3));
    expect(wrapper.find('input.c7n-pro-input-number').prop('value')).toBe('3');
    wrapper.setProps({ children: render(7).props.children });
    expect(wrapper.find('input.c7n-pro-input-number').prop('value')).toBe('7');
    wrapper.find('input.c7n-pro-input-number').simulate('change', { target: { value: '9' } });
    wrapper.find('input.c7n-pro-input-number').simulate('blur');
    expect(onChange).toHaveBeenCalled();
    wrapper.unmount();
  });
});
