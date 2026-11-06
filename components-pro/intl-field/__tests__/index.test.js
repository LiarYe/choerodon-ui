import React from 'react';
import { mount } from 'enzyme';
import { unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import IntlField from '..';
import IntlList from '../IntlList';
import IntlFieldTest from './intlField';
import focusTest from '../../../tests/shared/focusTest';
import mountTest from '../../../tests/shared/mountTest';
import { open } from '../../modal-container/ModalContainer';
import DataSet from '../../data-set';
import ModalManager from '../../modal-manager';
import { getConfig } from '../../../components/configure';
import localeContext from '../../locale-context';

mountTest(() => <IntlList getConfig={getConfig} lang={localeContext.locale.lang} />);
mountTest(IntlField);
focusTest(IntlField);

describe('IntlField-pro', () => {
  let wrappers;
  const mountField = element => {
    const wrapper = mount(element);
    wrappers.push(wrapper);
    return wrapper;
  };
  const settle = async callback => {
    await act(async () => {
      await callback();
      await new Promise(resolve => setTimeout(resolve, 250));
    });
  };

  beforeEach(() => {
    wrappers = [];
  });

  afterEach(async () => {
    await act(async () => {
      wrappers.forEach(wrapper => wrapper.unmount());
      await Promise.resolve();
      await Promise.resolve();
    });
    if (ModalManager.root) {
      unmountComponentAtNode(ModalManager.root);
      ModalManager.root.remove();
      delete ModalManager.root;
    }
    document.body.innerHTML = '';
  });

  const _pro = className => {
    return document.body.querySelectorAll(className);
  };

  it('renders IntlField correctly', () => {
    const wrapper = mountField(<IntlField />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should focused when the input click or mousedown', async () => {
    const wrapper = mountField(<IntlField />);
    expect(wrapper.find('.c7n-pro-input-focused')).toHaveLength(0);
    await settle(() => wrapper.find('input').simulate('focus'));
    wrapper.update();
    expect(wrapper.find('.c7n-pro-input-focused')).toHaveLength(1);
  });

  it('input should render readOnly correctly', async () => {
    const wrapper = mountField(<IntlField />);
    expect(wrapper.prop('readOnly')).toBe(false);
    wrapper.setProps({ readOnly: true });
    wrapper.update();
    expect(wrapper.prop('readOnly')).toBe(true);
    expect(wrapper.find('input').prop('readOnly')).toBe(true);
    await settle(() => wrapper.find('.c7n-pro-input-suffix').simulate('click'));
    expect(_pro('.c7n-pro-modal-container')).toHaveLength(1);
    expect(_pro('.c7n-pro-modal input').length).toBeGreaterThan(0);
    expect(Array.from(_pro('.c7n-pro-modal input')).every(input => input.readOnly)).toBe(true);
    expect(_pro('.c7n-pro-btn-primary')).toHaveLength(0);
  });

  it('trigger onOk once when click on ok button', async () => {
    const onCancel = jest.fn();
    const onOk = jest.fn();
    await settle(() => open({
      onCancel,
      onOk,
    }));
    await settle(() => _pro('.c7n-pro-modal-footer')[0]
      .querySelector('.c7n-pro-btn-primary')
      .click());
    expect(onCancel.mock.calls.length).toBe(0);
    expect(onOk.mock.calls.length).toBe(1);
  });

  it('renders dataset correctly', () => {
    const handleDataSetChange = jest.fn();
    const wrapper = mountField(<IntlFieldTest />);
    expect(wrapper.find('IntlField').props().name).toEqual('first-name');
    expect(wrapper.find('input').props().value).toEqual('吴');
    expect(wrapper).toMatchSnapshot();
    const ds = new DataSet({
      lang: 'en_GB',
      primaryKey: 'pk',
      data: [{}],
      tlsUrl: '/dataset/user/languages',
      fields: [
        {
          name: 'first',
          type: 'intl',
          required: true,
        },
      ],
      events: {
        update: handleDataSetChange,
      },
    });
    const wrapper1 = mountField(<IntlField dataSet={ds} name="first" />);
    expect(wrapper1.find('IntlField').props().name).toEqual('first');
    expect(wrapper1).toMatchSnapshot();
  });

  it('{ ok, cancel } button click render correctly', async () => {
    const onOk = jest.fn();
    const onCancel = jest.fn();
    const wrapper = mountField(<IntlField modalProps={{ onOk, onCancel }} />);
    expect(_pro('.c7n-pro-modal-container')).toHaveLength(0);
    await settle(() => wrapper.find('.c7n-pro-input-suffix').simulate('click'));
    expect(_pro('.c7n-pro-modal-container')).toHaveLength(1);
    expect(_pro('.c7n-pro-btn')).toHaveLength(2);
    await settle(() => _pro('.c7n-pro-btn-primary')[0].click());
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(wrapper.instance().modal).toBeUndefined();
    await settle(() => wrapper.find('.c7n-pro-input-suffix').simulate('click'));
    await settle(() => _pro('.c7n-pro-btn-default')[0].click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(wrapper.instance().modal).toBeUndefined();
    wrapper.setProps({ modalProps: undefined });
    wrapper.update();
    expect(wrapper).toMatchSnapshot();
  });

  it('the input keydown event , keyCode {down}', async () => {
    const wrapper = mountField(<IntlField />);
    expect(_pro('.c7n-pro-modal-container')).toHaveLength(0);
    await settle(() => wrapper.find('input').simulate('keydown', { keyCode: 40 }));
    wrapper.update();
    expect(_pro('.c7n-pro-modal-container')).toHaveLength(1);
  });

  it('modal should unmout', () => {
    const wrapper = mount(<IntlField />);
    wrapper.unmount();
  });
});
