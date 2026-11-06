import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { DISABLED_FIELD, Select } from '../../select/Select';
import Transfer from '../Transfer';
import TransferList from '../TransferList';
import DataSet from '../../data-set';
import basicDemo from '../demo/basic.md';

describe('Transfer bounded rendering', () => {
  let spies;

  it('moves declarative options through basic demo DOM buttons without cancelling Enter', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wrapper = mount(basicDemo, { attachTo: host });
    const instance = wrapper.find(Transfer).instance();
    const options = instance.options;
    const items = direction => wrapper.find(TransferList)
      .filterWhere(node => node.prop('direction') === direction)
      .find('li').map(node => node.text());
    try {
      act(() => { wrapper.find('li').filterWhere(node => node.text() === 'Jack').first().getDOMNode().click(); });
      wrapper.update();
      const button = wrapper.find('.c7n-pro-transfer-operation button').last().getDOMNode();
      expect(button.disabled).toBe(false);
      expect(instance.sourceSelected.map(record => record.get('value'))).toEqual(['jack']);
      act(() => { button.focus(); });
      expect(document.activeElement).toBe(button);
      const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });
      act(() => { button.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
      act(() => { button.click(); });
      await act(async () => { await Promise.resolve(); });
      wrapper.update();
      expect(instance.getValues()).toEqual(['jack']);
      expect(items('right')).toEqual(['Jack']);
      expect(items('left')).toEqual(['Lucy', 'Wu']);
      expect(instance.sourceSelected).toHaveLength(0);
      expect(instance.options).toBe(options);
      expect(wrapper.find('.c7n-pro-transfer-operation button').last().getDOMNode().disabled).toBe(true);
      act(() => { wrapper.find('li').filterWhere(node => node.text() === 'Jack').first().getDOMNode().click(); });
      wrapper.update();
      const leftButton = wrapper.find('.c7n-pro-transfer-operation button').first().getDOMNode();
      expect(leftButton.disabled).toBe(false);
      act(() => { leftButton.click(); });
      await act(async () => { await Promise.resolve(); });
      wrapper.update();
      expect(instance.getValues()).toEqual([]);
      expect(items('left')).toEqual(['Jack', 'Lucy', 'Wu']);
    } finally {
      wrapper.unmount();
      host.remove();
    }
  });

  beforeEach(() => {
    const counts = {};
    const track = name => {
      counts[name] = (counts[name] || 0) + 1;
      if (counts[name] > 100) throw new Error(`Transfer bounded guard: ${name}`);
    };
    spies = [];
    [
      [Transfer.prototype, 'renderWrapper'],
      [TransferList.prototype, 'renderWrapper'],
      [Select.prototype, 'processSelectedData'],
      [Select.prototype, 'generateComboOption'],
    ].forEach(([prototype, name]) => {
      const original = prototype[name];
      spies.push(jest.spyOn(prototype, name).mockImplementation(function tracked(...args) {
        track(`${prototype.constructor.name}.${name}`);
        return original.apply(this, args);
      }));
    });
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
  });

  it('settles after controlled updates without rewriting identical filtered records', () => {
    const options = new DataSet({ data: [{ value: 'a', meaning: 'Alpha' }, { value: 'b', meaning: 'Beta' }] });
    let wrapper;
    try {
      wrapper = mount(<Transfer options={options} value={['b']} sortable searchable />);
      wrapper.setProps({ value: ['a'], titles: ['Source', 'Target'] });
      expect(wrapper.instance().getValues()).toEqual(['a']);
      const snapshot = options.getState('targetFilteredOptions');
      expect(snapshot).toEqual([options.get(0)]);
      wrapper.setProps({ titles: ['New source', 'New target'] });
      expect(options.getState('targetFilteredOptions')).toBe(snapshot);
      expect(spies[0].mock.calls.length).toBeLessThan(8);
      expect(spies[1].mock.calls.length).toBeLessThan(16);
    } finally {
      if (wrapper) wrapper.unmount();
    }
  });

  it('preserves search, disabled selection, movement, sorting and one-way removal', () => {
    const options = new DataSet({ data: [
      { value: 'a', meaning: 'Alpha' },
      { value: 'b', meaning: 'Beta' },
      { value: 'c', meaning: 'Gamma', [DISABLED_FIELD]: true },
    ] });
    const wrapper = mount(<Transfer options={options} defaultValue={['b']} sortable searchable />);
    const instance = wrapper.instance();
    const list = direction => wrapper.find(TransferList).filterWhere(node => node.prop('direction') === direction).instance();
    const values = () => options.getState('targetFilteredOptions').map(record => record.get('value'));
    try {
      wrapper.setProps({ titles: ['Source', 'Target'] });
      act(() => { list('left').handleSelectAllChange(true); });
      expect(instance.sourceSelected.map(record => record.get('value'))).toEqual(['a']);
      act(() => { instance.handleMoveToRight(); });
      expect(instance.getValues()).toEqual(['b', 'a']);
      expect(values()).toEqual(['b', 'a']);
      act(() => { options.locate(0); });
      act(() => { instance.handleSortTo('down'); });
      expect(values()).toEqual(['a', 'b']);
      act(() => { list('right').setText('Beta'); });
      expect(values()).toEqual(['b']);
      act(() => { list('right').handleClear(); });
      expect(values()).toEqual(['a', 'b']);
      act(() => { instance.handleTargetSelectAllChange([options.find(record => record.get('value') === 'a')]); });
      act(() => { instance.handleMoveToLeft(); });
      expect(instance.getValues()).toEqual(['b']);
      wrapper.setProps({ oneWay: true });
      act(() => { list('right').handleRemove('b'); });
      expect(instance.getValues()).toEqual([]);
      expect(values()).toEqual([]);
    } finally {
      wrapper.unmount();
    }
  });

  it('supports declarative options and disposes inherited reactions', () => {
    const wrapper = mount(<Transfer defaultValue={['b']}>
      <Transfer.Option value="a">Alpha</Transfer.Option>
      <Transfer.Option value="b">Beta</Transfer.Option>
    </Transfer>);
    const instances = [wrapper.instance(), ...wrapper.find(TransferList).map(node => node.instance())];
    try {
      wrapper.setProps({ titles: ['Source', 'Target'] });
      expect(wrapper.instance().getValues()).toEqual(['b']);
      expect(wrapper.instance().options.length).toBe(2);
      instances.forEach(instance => expect(instance.checkValueReaction).toEqual(expect.any(Function)));
    } finally {
      wrapper.unmount();
    }
    instances.forEach(instance => expect(instance.checkValueReaction).toBeUndefined());
  });
});
