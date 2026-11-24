import React from 'react';
import * as ReactDOM from 'react-dom';
import scrollIntoView from 'dom-scroll-into-view';
import Menu, { Item, SubMenu } from 'choerodon-ui/lib/rc-components/menu';

jest.mock('dom-scroll-into-view', () => jest.fn());

// Only the renderer differs; run the same DOM interactions on both React versions.
const legacy = React.version.startsWith('16.');
const act = legacy ? require('react-dom/test-utils').act : React.act;
const createRoot = legacy ? null : require('react-dom/client').createRoot;

it('propagates nested selection, moves the active item and scrolls through the connected menu ref', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const ref = React.createRef();
  const onSelect = jest.fn();
  const tree = (
    <Menu ref={ref} mode="inline" defaultOpenKeys={['group']} defaultActiveFirst onSelect={onSelect}>
      <Item key="first">First</Item>
      <Item key="second">Second</Item>
      <SubMenu key="group" title="Group">
        <Item key="nested">Nested</Item>
      </SubMenu>
    </Menu>
  );
  const previousActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = legacy ? null : createRoot(container);
  try {
    act(() => {
      if (legacy) ReactDOM.render(tree, container);
      else root.render(tree);
    });
    const menu = container.querySelector('.rc-menu-root');
    const item = key => menu.querySelector(`[data-menu-key="${key}"]`);
    const nested = item('nested');
    act(() => { nested.click(); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'nested', selectedKeys: ['nested'] }));
    expect(nested.classList.contains('rc-menu-item-selected')).toBe(true);
    expect(nested.closest('.rc-menu-submenu').classList.contains('rc-menu-submenu-selected')).toBe(true);

    const arrow = (key, keyCode) => act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
    });
    arrow('ArrowDown', 40);
    expect(item('second').classList.contains('rc-menu-item-active')).toBe(true);
    arrow('ArrowUp', 38);
    expect(item('first').classList.contains('rc-menu-item-active')).toBe(true);
    expect(item('second').classList.contains('rc-menu-item-active')).toBe(false);

    const instances = ref.current.getFlatInstanceArray();
    expect(instances.map(instance => instance.props.eventKey)).toEqual(['first', 'second', 'group']);
    expect(ref.current.step(1)).toBe(instances[1]);
    const onActive = jest.fn();
    act(() => {
      const down = new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, cancelable: true });
      expect(ref.current.onKeyDown(down, onActive)).toBe(1);
      expect(down.defaultPrevented).toBe(true);
    });
    expect(onActive).toHaveBeenCalledWith(instances[1]);
    expect(item('second').classList.contains('rc-menu-item-active')).toBe(true);
    expect(ref.current.step(-1)).toBe(instances[0]);

    scrollIntoView.mockClear();
    ref.current.scrollToKey('nested');
    expect(scrollIntoView).toHaveBeenCalledWith(nested, menu, { onlyScrollIfNeeded: true });
  } finally {
    act(() => {
      if (legacy) ReactDOM.unmountComponentAtNode(container);
      else root.unmount();
    });
    global.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    container.remove();
  }
});
