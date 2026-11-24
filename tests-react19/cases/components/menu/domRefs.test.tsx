import React from 'react';
import { render } from '@testing-library/react';
import scrollIntoView from 'dom-scroll-into-view';
import DOMWrap from '../../../../components/rc-components/menu/DOMWrap';
import { MenuItem } from '../../../../components/rc-components/menu/MenuItem';

jest.mock('dom-scroll-into-view', () => jest.fn());

it('merges attribute.ref with the li ref across updates, replacements and unmount', () => {
  const cleanup = jest.fn();
  const callback = jest.fn(() => cleanup);
  const object = React.createRef<HTMLLIElement>();
  const plain = jest.fn();
  const instance = React.createRef<MenuItem>();
  const tree = (ref: React.Ref<HTMLLIElement>) => (
    <MenuItem ref={instance} rippleDisabled attribute={{ ref }}>Item</MenuItem>
  );
  const { container, rerender, unmount } = render(tree(callback));
  const li = container.querySelector('li');
  expect(li).not.toBeNull();
  rerender(tree(callback));
  expect(callback.mock.calls).toEqual([[li]]);
  expect(cleanup).not.toHaveBeenCalled();
  rerender(tree(object));
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls).toEqual([[li]]);
  expect(object.current).toBe(li);
  expect(instance.current!.itemRef.current).toBe(li);
  rerender(tree(plain));
  expect(object.current).toBeNull();
  unmount();
  expect(plain.mock.calls).toEqual([[li], [null]]);
});

it('keeps keyed virtual rows and their refs attached when the order changes', () => {
  const instance = React.createRef<MenuItem>();
  const row = React.createRef<HTMLLIElement>();
  const wrap = React.createRef<DOMWrap>();
  const tree = (keys: string[]) => (
    <DOMWrap ref={wrap} tag="ol" virtual>
      {keys.map(key => (
        <MenuItem key={key} eventKey={key} ref={key === 'a' ? instance : undefined}
          attribute={{ ref: key === 'a' ? row : undefined }} rippleDisabled>{key}</MenuItem>
      ))}
    </DOMWrap>
  );
  const { container, rerender, unmount } = render(tree(['a', 'b']));
  const li = row.current;
  const menuItem = instance.current;
  expect(li).toBe(container.querySelector('.rc-virtual-list-holder-inner > li'));
  expect(menuItem!.itemRef.current).toBe(li);
  rerender(tree(['b', 'a']));
  expect(wrap.current!.getScrollContainer()).toBe(container.querySelector('ol'));
  expect(container.querySelector('li:last-child')).toBe(li);
  expect(instance.current).toBe(menuItem);
  expect(row.current).toBe(li);
  unmount();
  expect(instance.current).toBeNull();
  expect(row.current).toBeNull();
});

it('uses the existing tag and li without replacing the manual instance ref', () => {
  const wrap = React.createRef<DOMWrap>();
  const instance = jest.fn();
  const tree = (active: boolean) => (
    <DOMWrap ref={wrap} tag="ol">
      {[<MenuItem key="item" eventKey="item" active={active} rippleDisabled manualRef={instance}
        getScrollContainer={() => wrap.current?.getScrollContainer()}>Item</MenuItem>]}
    </DOMWrap>
  );
  const { container, rerender, unmount } = render(tree(false));
  const menu = wrap.current!;
  const item = instance.mock.calls[0][0];
  rerender(tree(true));
  expect(menu.getScrollContainer()).toBe(container.querySelector('ol'));
  expect(instance).toHaveBeenLastCalledWith(item);
  expect(scrollIntoView).toHaveBeenCalledWith(container.querySelector('ol > li'), menu.getScrollContainer(), { onlyScrollIfNeeded: true });
  unmount();
  expect(menu.getScrollContainer()).toBeNull();
});
