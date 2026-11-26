import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Item from 'choerodon-ui/lib/transfer/item';
import List from 'choerodon-ui/lib/transfer/list';

const original = window.IntersectionObserver;
const observers = [];

beforeEach(() => {
  window.IntersectionObserver = class {
    constructor(notify, options) {
      Object.assign(this, options);
      this.targets = new Set();
      this.emit = (target, visible) => act(() => {
        if (this.targets.has(target)) notify([{ target, isIntersecting: visible, intersectionRatio: Number(visible) }]);
      });
      observers.push(this);
    }

    observe(node) { this.targets.add(node); }

    unobserve(node) { this.targets.delete(node); }

    disconnect() { this.targets.clear(); }
  };
});

afterEach(() => {
  window.IntersectionObserver = original;
  observers.length = 0;
  jest.useRealTimers();
});

const props = { item: { key: 'a' }, renderedText: 'A', renderedEl: 'A', prefixCls: 'item' };

it('requires current visibility of both container and row, then keeps the whole row mounted', () => {
  const onContentVisible = jest.fn();
  const lazy = { elementType: 'section', className: 'extra', height: 24, width: '50%', threshold: 42,
    offsetHorizontal: 16, offsetTop: 8, onContentVisible };
  const { container, rerender } = render(<div style={{ overflowY: 'auto' }}><Item {...props} lazy={lazy} /></div>);
  const root = container.firstChild;
  const wrapper = root.querySelector('section.LazyLoad.extra');
  const outer = observers.find(o => !o.root);
  const inner = observers.find(o => o.root === root);
  expect([outer.rootMargin, inner.rootMargin]).toEqual(Array(2).fill('8px 16px 42px 16px'));
  expect([wrapper.style.height, wrapper.style.width]).toEqual(['24px', '50%']);
  inner.emit(wrapper, true);
  expect(wrapper.firstChild).toBeNull();
  inner.emit(wrapper, false);
  outer.emit(root, true);
  expect(wrapper.firstChild).toBeNull();
  inner.emit(wrapper, true);
  const row = wrapper.querySelector('li');
  expect(row.querySelector('input')).not.toBeNull();
  expect(wrapper.classList.contains('is-visible')).toBe(true);
  expect(inner.targets.size + outer.targets.size).toBe(0);
  rerender(<div style={{ overflowY: 'auto' }}><Item {...props} checked lazy={lazy} /></div>);
  expect(wrapper.firstChild).toBe(row);
  expect(row.querySelector('input').checked).toBe(true);
  expect(onContentVisible).toHaveBeenCalledTimes(1);
});

it('reveals sibling rows and replays the visible root for rows restored by clearing a filter', () => {
  const visible = jest.fn();
  const data = ['keep', 'also', 'far'].map(key => ({ key }));
  const list = filter => <div style={{ overflow: 'auto' }}><List prefixCls="transfer" dataSource={data}
    checkedKeys={[]} filter={filter} lazy={{ onContentVisible: visible }} render={item => item.key} /></div>;
  const { container, rerender } = render(list(''));
  const root = container.firstChild;
  const rows = () => Array.from(root.querySelectorAll('.LazyLoad'));
  const outer = observers.find(o => !o.root);
  const inner = observers.find(o => o.root === root);
  rows().slice(0, 2).forEach(row => inner.emit(row, true));
  outer.emit(root, true);
  expect(rows().map(row => row.textContent)).toEqual(['keep', 'also', '']);
  // The offscreen row keeps the root observed; clearing the filter does not
  // produce a second viewport intersection for that same root.
  rerender(list('far'));
  rerender(list(''));
  rows().slice(0, 2).forEach(row => inner.emit(row, true));
  expect(rows().map(row => row.textContent)).toEqual(['keep', 'also', '']);
  expect(visible).toHaveBeenCalledTimes(4);
});

const Forwarded = React.memo(React.forwardRef((props, ref) => <section {...props} ref={ref} />));

it.each([true, false])('reveals the initial visible pair without a timer (debounce=%s)', debounce => {
  jest.useFakeTimers();
  const lazy = { throttle: 100, debounce, elementType: Forwarded, onContentVisible: jest.fn() };
  const { container } = render(<div style={{ overflow: 'auto' }}><Item {...props} lazy={lazy} /></div>);
  const root = container.firstChild;
  const wrapper = root.firstChild;
  const reportRoot = () => observers.find(o => !o.root).emit(root, true);
  const reportRow = () => observers.find(o => o.root === root).emit(wrapper, true);
  const [first, second] = debounce ? [reportRow, reportRoot] : [reportRoot, reportRow];
  first();
  expect(wrapper.firstChild).toBeNull();
  second();
  expect(wrapper.matches('section.is-visible')).toBe(true);
  expect(wrapper.firstChild.tagName).toBe('LI');
  expect(lazy.onContentVisible).toHaveBeenCalledTimes(1);
});

const Plain = wrapperProps => <section {...wrapperProps} />;
class ClassWrapper extends React.PureComponent {
  render() { return <Plain {...this.props} />; }
}
const Handle = React.forwardRef((wrapperProps, ref) => {
  React.useImperativeHandle(ref, () => ({}));
  return <Plain {...wrapperProps} />;
});

it.each([Plain, ClassWrapper, Handle])('renders wrappers without a DOM ref immediately', elementType => {
  const lazy = { elementType, onContentVisible: jest.fn() };
  const { container, rerender } = render(<Item {...props} lazy={lazy} />);
  expect(container.querySelector('section.is-visible > li')).not.toBeNull();
  rerender(<Item {...props} checked lazy={lazy} />);
  expect(lazy.onContentVisible).toHaveBeenCalledTimes(1);
  expect(observers).toHaveLength(0);
});

it.each([true, false])('honors custom scheduling (debounce=%s) and cancels stale visibility', debounce => {
  jest.useFakeTimers();
  const lazy = { throttle: 50, debounce };
  const { container } = render(<Item {...props} lazy={lazy} />);
  const wrapper = container.firstChild;
  const [observer] = observers;
  expect(observer.rootMargin).toBe('500px 500px 500px 500px');
  expect(wrapper.style.height).toBe('0.32rem');
  observer.emit(wrapper, false);
  observer.emit(wrapper, true);
  expect(wrapper.firstChild).toBeNull();
  observer.emit(wrapper, false);
  act(() => jest.advanceTimersByTime(50));
  expect(wrapper.firstChild).toBeNull();
  observer.emit(wrapper, true);
  expect(Boolean(wrapper.firstChild)).toBe(!debounce);
  act(() => jest.advanceTimersByTime(50));
  expect(wrapper.firstChild.tagName).toBe('LI');
});

it('renders lazy=false directly and filters without dispatching scroll', () => {
  jest.useFakeTimers();
  const handleFilter = jest.fn();
  const onScroll = jest.fn();
  const { container } = render(<List prefixCls="transfer" dataSource={[props.item]} checkedKeys={[]}
    showSearch lazy={false} onScroll={onScroll} handleFilter={handleFilter} render={item => item.key} />);
  expect(container.querySelector('ul > li')).not.toBeNull();
  fireEvent.change(container.querySelector('input:not([type=checkbox])'), { target: { value: 'a' } });
  act(() => jest.runOnlyPendingTimers());
  expect(handleFilter).toHaveBeenCalledTimes(1);
  expect(onScroll).not.toHaveBeenCalled();
  expect(observers).toHaveLength(0);
});
