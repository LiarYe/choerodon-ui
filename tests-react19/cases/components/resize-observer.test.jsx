import React, { forwardRef, useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import ResizeObserver from 'resize-observer-polyfill';
import ReactResizeObserver from 'choerodon-ui/lib/_util/resizeObserver';

let subscriptions;

beforeEach(() => {
  subscriptions = new Map();
  jest.spyOn(ResizeObserver.prototype, 'observe').mockImplementation(function observe(target) {
    subscriptions.set(target, this);
  });
  jest.spyOn(ResizeObserver.prototype, 'disconnect').mockImplementation(function disconnect() {
    subscriptions.forEach((observer, target) => {
      if (observer === this) subscriptions.delete(target);
    });
  });
});

afterEach(() => jest.restoreAllMocks());

it('runs the original callback ref cleanup on replacement and unmount without sending null', () => {
  const cleanupFirst = jest.fn();
  const cleanupSecond = jest.fn();
  const ref = jest.fn().mockReturnValueOnce(cleanupFirst).mockReturnValueOnce(cleanupSecond);
  const view = key => <ReactResizeObserver><div key={key} ref={ref} /></ReactResizeObserver>;
  const { container, rerender, unmount } = render(view('first'));
  const first = container.firstChild;
  expect(ref.mock.calls).toEqual([[first]]);
  expect(Array.from(subscriptions.keys())).toEqual([first]);

  rerender(view('second'));
  const second = container.firstChild;
  expect(second).not.toBe(first);
  expect(ref.mock.calls).toEqual([[first], [second]]);
  expect(cleanupFirst).toHaveBeenCalledTimes(1);
  expect(cleanupSecond).not.toHaveBeenCalled();
  expect(Array.from(subscriptions.keys())).toEqual([second]);

  unmount();
  expect(ref.mock.calls).toEqual([[first], [second]]);
  expect(cleanupFirst).toHaveBeenCalledTimes(1);
  expect(cleanupSecond).toHaveBeenCalledTimes(1);
  expect(subscriptions.size).toBe(0);
});

it('re-observes a same-size DOM replacement triggered only by forwardRef child state', () => {
  const Child = forwardRef(function Child(_, ref) {
    const [swapped, setSwapped] = useState(false);
    return (
      <button key={String(swapped)} ref={ref} type="button" onClick={() => setSwapped(true)}>
        {swapped ? 'replacement' : 'original'}
      </button>
    );
  });
  const ref = React.createRef();
  const onResize = jest.fn();
  const { container, getByRole, unmount } = render(
    <ReactResizeObserver immediately onResize={onResize}>
      <Child ref={ref} />
    </ReactResizeObserver>,
  );
  const first = getByRole('button', { name: 'original' });
  expect(container.firstChild).toBe(first);
  expect(ref.current).toBe(first);
  expect(Array.from(subscriptions.keys())).toEqual([first]);

  fireEvent.click(first);
  const second = getByRole('button', { name: 'replacement' });
  expect(second).not.toBe(first);
  expect(container.firstChild).toBe(second);
  expect(ref.current).toBe(second);
  expect(Array.from(subscriptions.keys())).toEqual([second]);
  expect(onResize.mock.calls).toEqual([[0, 0, first], [0, 0, second]]);

  unmount();
  expect(ref.current).toBeNull();
  expect(subscriptions.size).toBe(0);
});
