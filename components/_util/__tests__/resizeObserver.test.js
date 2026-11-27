import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import ResizeObserver from 'resize-observer-polyfill';
import ReactResizeObserver from '../resizeObserver';

jest.mock('resize-observer-polyfill', () => jest.fn());

let container;
let subscriptions;

function update(element) {
  act(() => {
    render(element, container);
  });
}

function emit(target, width, height, borderBoxSize) {
  act(() => {
    subscriptions.get(target)([{ target, contentRect: { width, height }, borderBoxSize }]);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  subscriptions = new Map();
  ResizeObserver.mockImplementation(notify => ({
    observe: target => { subscriptions.set(target, notify); },
    unobserve: target => { subscriptions.delete(target); },
    disconnect: () => {
      subscriptions.forEach((callback, target) => {
        if (callback === notify) subscriptions.delete(target);
      });
    },
  }));
});

afterEach(() => {
  act(() => {
    unmountComponentAtNode(container);
  });
  container.remove();
  jest.restoreAllMocks();
});

it('preserves the native child object ref and re-observes a same-size replacement without a wrapper', () => {
  const ref = React.createRef();
  const onResize = jest.fn();
  const view = key => (
    <ReactResizeObserver boxSize="contentBox" onResize={onResize}>
      <div key={key} ref={ref} />
    </ReactResizeObserver>
  );

  update(view('first'));
  const first = ref.current;
  expect(first).toBeInstanceOf(HTMLDivElement);
  expect(container.firstChild).toBe(first);
  expect(Array.from(subscriptions.keys())).toEqual([first]);
  emit(first, 80, 40);
  emit(first, 80, 40);
  expect(onResize.mock.calls).toEqual([[80, 40, first]]);

  update(view('second'));
  const second = ref.current;
  expect(second).not.toBe(first);
  expect(container.firstChild).toBe(second);
  expect(Array.from(subscriptions.keys())).toEqual([second]);
  emit(second, 80, 40);
  expect(onResize.mock.calls).toEqual([[80, 40, first], [80, 40, second]]);
});

it('uses the explicit target, pauses while disabled and releases the target on null or unmount', () => {
  const target = document.createElement('section');
  const second = document.createElement('aside');
  const onResize = jest.fn();
  const Child = () => <p>untouched child</p>;
  const view = (element, disabled = false) => (
    <ReactResizeObserver getTarget={() => element} disabled={disabled} onResize={onResize}>
      <Child />
    </ReactResizeObserver>
  );

  update(view(null));
  expect(container.innerHTML).toBe('<p>untouched child</p>');
  expect(subscriptions.size).toBe(0);
  update(view(target, true));
  expect(subscriptions.size).toBe(0);
  update(view(target));
  expect(Array.from(subscriptions.keys())).toEqual([target]);
  update(view(second, true));
  expect(subscriptions.size).toBe(0);
  update(view(second));
  expect(Array.from(subscriptions.keys())).toEqual([second]);
  update(view(null));
  expect(subscriptions.size).toBe(0);
  update(view(target));
  expect(Array.from(subscriptions.keys())).toEqual([target]);
  update(null);
  expect(subscriptions.size).toBe(0);
  expect(onResize).not.toHaveBeenCalled();
});

it('reports offset dimensions immediately when observation starts', () => {
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(93);
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(27);
  const onResize = jest.fn();
  const view = title => (
    <ReactResizeObserver immediately onResize={onResize}>
      <div title={title} />
    </ReactResizeObserver>
  );

  update(view('before'));
  const target = container.firstChild;
  expect(onResize.mock.calls).toEqual([[93, 27, target]]);
  update(view('after'));
  expect(onResize.mock.calls).toEqual([[93, 27, target]]);
});

it('uses and rounds border box sizes, falling back to the bounding rectangle', () => {
  const onResize = jest.fn();
  update(<ReactResizeObserver onResize={onResize}><div /></ReactResizeObserver>);
  const target = container.firstChild;
  jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({ width: 29.6, height: 39.4 });

  emit(target, 10, 20, [{ inlineSize: 19.6, blockSize: 29.4 }]);
  emit(target, 10, 20);
  expect(onResize.mock.calls).toEqual([[20, 29, target], [30, 39, target]]);
});

it.each([
  ['width', 10.4, 25.6, 15.6, 25.6, 16, 26],
  ['height', 15.6, 20.4, 15.6, 25.6, 16, 26],
])('uses rounded content dimensions and only notifies on %s changes', (
  resizeProp, ignoredWidth, ignoredHeight, width, height, roundedWidth, roundedHeight,
) => {
  const onResize = jest.fn();
  update(
    <ReactResizeObserver boxSize="contentBox" resizeProp={resizeProp} onResize={onResize}>
      <div />
    </ReactResizeObserver>,
  );
  const target = container.firstChild;
  const border = [{ inlineSize: 90, blockSize: 100 }];
  emit(target, 10.2, 20.2, border);
  emit(target, ignoredWidth, ignoredHeight, border);
  expect(onResize.mock.calls).toEqual([[10, 20, target]]);
  emit(target, width, height, border);
  expect(onResize.mock.calls).toEqual([[10, 20, target], [roundedWidth, roundedHeight, target]]);
});
