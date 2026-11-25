import { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Carousel from '../../../../components/carousel/index.tsx';

const slides = [0, 1, 2].map(index => <div key={index}>{index}</div>);

function swipeLeft(list: Element) {
  fireEvent.touchStart(list, { touches: [{ pageX: 200, pageY: 20 }] });
  fireEvent.touchMove(list, { touches: [{ pageX: 40, pageY: 20 }] });
  fireEvent.touchEnd(list);
}

test.each([false, true])('dispatches swipe and lazy-load callbacks (responsive override: %s)', override => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  try {
    const base = { onSwipe: jest.fn(), onLazyLoad: jest.fn() };
    const narrow = { onSwipe: jest.fn(), onLazyLoad: jest.fn() };
    const responsive = override ? [{ breakpoint: 480, settings: narrow }] : undefined;
    const { container } = render(
      <Carousel {...base} responsive={responsive} infinite={false} lazyLoad="ondemand" speed={0}>{slides}</Carousel>,
    );
    expect(base.onLazyLoad).toHaveBeenCalledWith([0]);
    base.onLazyLoad.mockClear();
    swipeLeft(container.querySelector('.slick-list')!);
    const active = override ? narrow : base;
    expect(active.onSwipe.mock.calls).toEqual([['left']]);
    expect(active.onLazyLoad.mock.calls).toEqual([[[1]]]);
    expect(container.querySelector('.slick-current')?.getAttribute('data-index')).toBe('1');
    if (override) {
      expect(base.onSwipe).not.toHaveBeenCalled();
      expect(base.onLazyLoad).not.toHaveBeenCalled();
    }
  } finally {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  }
});

test.each([false, true])('asNavFor follows the live target without rerendering the source (responsive override: %s)', override => {
  jest.useFakeTimers();
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  try {
    const target = createRef<Carousel>();
    const source = createRef<Carousel>();
    const change = jest.fn();
    const fallback = { innerSlider: { slideHandler: jest.fn() } };
    const targetView = (unslick: boolean) => (
      <Carousel ref={target} beforeChange={change} useCSS={false}
        responsive={unslick ? [{ breakpoint: 480, settings: 'unslick' }] : undefined}>{slides}</Carousel>
    );
    const destination = render(targetView(false));
    const origin = render(
      <Carousel ref={source} useCSS={false} asNavFor={override ? fallback : target.current}
        responsive={override ? [{ breakpoint: 480, settings: { asNavFor: target.current } }] : undefined}>{slides}</Carousel>,
    );
    const goTo = (index: number) => {
      act(() => { source.current!.goTo(index); jest.advanceTimersByTime(20); });
      expect(origin.container.querySelector('.slick-current')?.getAttribute('data-index')).toBe(String(index));
    };
    goTo(1);
    expect(change.mock.calls).toEqual([[0, 1]]);
    destination.rerender(targetView(true));
    expect(target.current!.innerSlider).toBeNull();
    goTo(2);
    destination.rerender(targetView(false));
    goTo(2);
    expect(destination.container.querySelector('.slick-current')?.getAttribute('data-index')).toBe('0');
    expect(change.mock.calls).toEqual([[0, 1]]);
    goTo(1);
    expect(destination.container.querySelector('.slick-current')?.getAttribute('data-index')).toBe('1');
    expect(change.mock.calls).toEqual([[0, 1], [0, 1]]);
    destination.unmount();
    goTo(0);
    expect(fallback.innerSlider.slideHandler).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
    jest.useRealTimers();
  }
});

test('asNavFor synchronizes two mounted carousels in both directions', () => {
  jest.useFakeTimers();
  try {
    const first = createRef<Carousel>();
    const second = createRef<Carousel>();
    const pair = () => <>
      <Carousel ref={first} asNavFor={second.current} useCSS={false}>{slides}</Carousel>
      <Carousel ref={second} asNavFor={first.current} useCSS={false}>{slides}</Carousel>
    </>;
    const { container, rerender } = render(pair());
    rerender(pair());
    for (const [index, ref] of [first, second].entries()) {
      act(() => { ref.current?.goTo(index + 1); jest.advanceTimersByTime(20); });
      expect(Array.from(container.querySelectorAll('.slick-current'), el => el.getAttribute('data-index')))
        .toEqual([String(index + 1), String(index + 1)]);
    }
  } finally {
    jest.useRealTimers();
  }
});
