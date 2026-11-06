import React from 'react';
import { mount } from 'enzyme';
import { unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import IntlField from '..';
import IntlList from '../IntlList';
import DataSet from '../../data-set';
import ModalManager from '../../modal-manager';
import localeContext from '../../locale-context';
import { getConfig } from '../../../components/configure';

describe('IntlField regressions', () => {
  let wrapper;
  let clock;

  const settle = async callback => {
    await act(async () => {
      await callback();
      await new Promise(resolve => setTimeout(resolve, 250));
    });
    wrapper.update();
  };

  const button = selector => document.body.querySelector(`.c7n-pro-modal-footer ${selector}`);

  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(async () => {
    if (clock) clock.mockRestore();
    clock = undefined;
    jest.useRealTimers();
    await act(async () => {
      if (wrapper) wrapper.unmount();
      await Promise.resolve();
      await Promise.resolve();
    });
    if (ModalManager.root) {
      unmountComponentAtNode(ModalManager.root);
      ModalManager.root.remove();
      delete ModalManager.root;
    }
    wrapper = undefined;
  });

  it('uses the supplied tls key and puts the active language first', () => {
    const lang = Object.keys(localeContext.supports).slice(-1)[0];
    const config = jest.fn(key => (key === 'tlsKey' ? 'translations' : getConfig(key)));
    wrapper = mount(<IntlList name="title" lang={lang} getConfig={config} />);
    expect(config).toHaveBeenCalledWith('tlsKey');
    expect(wrapper.find('input')).toHaveLength(Object.keys(localeContext.supports).length);
    expect(wrapper.find('input').first().prop('name')).toBe(`translations.title.${lang}`);
    expect(wrapper.find('TextField').first().prop('autoFocus')).toBe(true);
  });

  it('debounces suffix clicks against an advancing clock', async () => {
    jest.useFakeTimers();
    let now = Date.now();
    clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    wrapper = mount(<IntlField />);
    act(() => {
      wrapper.find('.c7n-pro-input-suffix').simulate('click');
      now += 199;
      jest.advanceTimersByTime(199);
    });
    expect(wrapper.instance().modal).toBeUndefined();
    act(() => {
      now += 1;
      jest.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(wrapper.instance().modal).toBeDefined();
    expect(document.body.querySelectorAll('.c7n-pro-modal')).toHaveLength(1);
  });

  it('validates translations on OK and restores them on cancel after reopening', async () => {
    const lang = localeContext.locale.lang;
    const tlsKey = getConfig('tlsKey');
    const dataSet = new DataSet({
      data: [{ title: 'Original', [tlsKey]: { title: { [lang]: 'Original' } } }],
      fields: [
        { name: 'title', type: 'intl', required: true },
        { name: `${tlsKey}.title.${lang}`, type: 'string', required: true },
      ],
    });
    wrapper = mount(<IntlField dataSet={dataSet} name="title" />);
    await settle(() => wrapper.instance().openModal());
    expect(button('.c7n-pro-btn-primary')).not.toBeNull();
    const field = dataSet.getField(`${tlsKey}.title.${lang}`);
    const validity = jest.spyOn(field, 'checkValidity').mockResolvedValue(false);
    await settle(() => button('.c7n-pro-btn-primary').click());
    expect(validity).toHaveBeenCalledWith(dataSet.current);
    expect(wrapper.instance().modal).toBeDefined();
    validity.mockResolvedValue(true);
    await settle(() => dataSet.current.set(`${tlsKey}.title.${lang}`, 'Saved'));
    await settle(() => button('.c7n-pro-btn-primary').click());
    validity.mockRestore();
    expect(wrapper.instance().modal).toBeUndefined();
    expect(dataSet.current.get('title')).toBe('Saved');
    await settle(() => wrapper.instance().openModal());
    await settle(() => dataSet.current.set(`${tlsKey}.title.${lang}`, 'Discarded'));
    await settle(() => button('.c7n-pro-btn-default').click());
    expect(wrapper.instance().modal).toBeUndefined();
    expect(dataSet.current.get('title')).toBe('Saved');
    expect(dataSet.current.get(`${tlsKey}.title.${lang}`)).toBe('Saved');
    expect(wrapper.find('input').prop('value')).toBe('Saved');
  });
});
