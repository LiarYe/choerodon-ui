import React from 'react';
import { mount } from 'enzyme';
import * as Pro from '../../index';
import Mentions from '../../mentions';
import TextArea from '../../text-area/TextArea';

describe('Pro entry observer inheritance', () => {
  it('loads the complete entry and preserves the public observed TextArea', () => {
    expect(Pro.Mentions).toBe(Mentions);
    expect(Pro.TextArea).toBe(TextArea);
    expect(Pro.TextArea.prototype.constructor).toBe(TextArea);
    expect(Object.getPrototypeOf(Pro.Mentions.prototype)).toBe(TextArea.prototype);
    expect(Pro.Mentions.getMentions('@first @second')).toEqual([
      { mentionsKey: '@', value: 'first' },
      { mentionsKey: '@', value: 'second' },
    ]);
    const wrapper = mount(<Pro.Mentions value="@first" />);
    expect(wrapper.find('textarea').prop('value')).toBe('@first');
    wrapper.setProps({ value: '@second' });
    expect(wrapper.find('textarea').prop('value')).toBe('@second');
    wrapper.unmount();
  });
});
