import React from 'react';
import { mount } from 'enzyme';
import IntlList from '../IntlList';
import mountTest from '../../../tests/shared/mountTest';
import { getConfig } from '../../../components/configure';
import localeContext from '../../locale-context';

mountTest(() => <IntlList getConfig={getConfig} lang={localeContext.locale.lang} />);

describe('IntlList-pro', () => {
  it('renders IntlField correctly', () => {
    const wrapper = mount(<IntlList getConfig={getConfig} lang={localeContext.locale.lang} />);
    try {
      expect(wrapper.find('input')).toHaveLength(Object.keys(localeContext.supports).length);
      expect(wrapper.find('input').first().prop('name')).toBe(localeContext.locale.lang);
      expect(wrapper).toMatchSnapshot();
    } finally {
      wrapper.unmount();
    }
  });
});
