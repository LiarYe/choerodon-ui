import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { autorun } from 'mobx';
import { ModalContainerClass, getContainer } from '../ModalContainer';
import Modal from '../../modal/Modal';

describe('mounted modal container offsets', () => {
  let wrappers;
  let hosts;

  beforeEach(() => {
    wrappers = [];
    hosts = [];
  });

  afterEach(() => {
    wrappers.reverse().forEach(wrapper => wrapper.unmount());
    hosts.forEach(host => host.remove());
  });

  function createHost() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    return host;
  }

  function createContainer(props = {}, host = createHost()) {
    const wrapper = mount(<ModalContainerClass {...props} />, { attachTo: host });
    wrappers.push(wrapper);
    return wrapper;
  }

  function openDrawer(wrapper, key, drawerOffset, drawerTransitionName = 'slide-right') {
    act(() => {
      wrapper.instance().open({
        ...Modal.defaultProps,
        key,
        drawer: true,
        drawerOffset,
        drawerTransitionName,
        transitionAppear: false,
        children: key,
      });
    });
    wrapper.update();
  }

  function margin(wrapper, key, name = 'marginRight') {
    wrapper.update();
    return wrapper.find(Modal).filterWhere(node => node.prop('eventKey') === key).prop('style')[name];
  }

  it.each(['slide-up', 'slide-right', 'slide-down', 'slide-left'])(
    'stacks mounted containers and drawers for %s and updates on close',
    direction => {
      const host = createHost();
      const first = createContainer({ getContainer: host });
      const second = createContainer({ getContainer: () => host });
      const side = {
        'slide-up': 'marginTop',
        'slide-right': 'marginRight',
        'slide-down': 'marginBottom',
        'slide-left': 'marginLeft',
      }[direction];
      openDrawer(first, 'first', 20, direction);
      openDrawer(second, 'second', 30, direction);
      expect(margin(first, 'first', side)).toBe(30);
      openDrawer(second, 'third', 40, direction);
      expect(margin(first, 'first', side)).toBe(70);
      expect(margin(second, 'second', side)).toBe(40);
      expect(host.style.overflow).toBe('hidden');
      act(() => second.instance().close({ key: 'third', destroyOnClose: true }));
      expect(margin(first, 'first', side)).toBe(30);
      act(() => second.instance().close({ key: 'second', destroyOnClose: true }));
      expect(margin(first, 'first', side)).toBeUndefined();
      expect(host.style.overflow).toBe('hidden');
    },
  );

  it('reacts to element and function container prop changes across mounted instances', () => {
    const shared = createHost();
    const separate = createHost();
    const first = createContainer({ getContainer: shared });
    const second = createContainer({ getContainer: separate });
    openDrawer(first, 'first', 20);
    openDrawer(second, 'second', 30);
    expect(margin(first, 'first')).toBeUndefined();
    second.setProps({ getContainer: () => shared });
    expect(margin(first, 'first')).toBe(30);
    expect(second.instance().getContainer()).toBe(shared);
    second.setProps({ getContainer: separate });
    expect(margin(first, 'first')).toBeUndefined();
    expect(second.instance().getContainer()).toBe(separate);
    expect(separate.textContent).toContain('second');
  });

  it('uses inline mount parents without reading another observer React state', async () => {
    const host = createHost();
    const second = createContainer({ getContainer: false }, host);
    const first = createContainer({ getContainer: host });
    openDrawer(first, 'first', 20);
    openDrawer(second, 'second', 30);
    expect(second.instance().state.mount.parentElement).toBe(host);
    expect(second.instance().getOffsetContainer()).toBe(host);
    expect(margin(first, 'first')).toBe(30);
    const body = createContainer({ getContainer: document.body });
    expect(await getContainer()).toBe(body.instance());
    let offset;
    const dispose = autorun(() => { offset = second.instance().getOffsetContainer(); });
    try {
      expect(offset).toBe(host);
    } finally {
      dispose();
    }
  });
});
