import { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Carousel from '../../../../components/carousel/index.tsx';

const slides = [1, 2, 3, 4].map(n => <div key={n}>{n}</div>);

let restoreMatchMedia: (() => void) | undefined;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
  jest.useRealTimers();
});

function mockViewport(initialWidth: number) {
  let width = initialWidth;
  const subscriptions = new Map<() => void, number>();
  const queries = new Set<Set<() => void>>();
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const matchMedia = jest.fn((media: string) => {
    const max = Number(/^\(max-width: ([\d.]+)px\)$/.exec(media)?.[1]);
    const listeners = new Set<() => void>();
    queries.add(listeners);
    const notify = () => listeners.forEach(listener => listener());
    subscriptions.set(notify, max);
    return {
      media,
      get matches() { return width <= max; },
      addListener: (listener: () => void) => listeners.add(listener),
      removeListener: (listener: () => void) => listeners.delete(listener),
    };
  });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
  restoreMatchMedia = () => {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
  return {
    resize(nextWidth: number) {
      const previous = width;
      width = nextWidth;
      act(() => subscriptions.forEach((max, notify) => {
        if ((previous <= max) !== (width <= max)) notify();
      }));
    },
    listeners: () => Array.from(queries).reduce((total, listeners) => total + listeners.size, 0),
  };
}

test('applies the narrow query on mount and restores the slider and controls after unslick', () => {
  jest.useFakeTimers();
  const viewport = mockViewport(360);
  const ref = createRef<Carousel>();
  const { container } = render(
    <Carousel ref={ref} slidesToShow={3} slidesToScroll={2} speed={0} dotsActionType={['hover']}
      responsive={[{ breakpoint: 800, settings: 'unslick' }, { breakpoint: 480, settings: { slidesToShow: 1 } }]}>
      {slides}
    </Carousel>,
  );
  expect(container.querySelectorAll('.slick-slide.slick-active')).toHaveLength(1);
  viewport.resize(480.5);
  expect(container.querySelector('.slick-slider')).toBeNull();
  expect(ref.current?.innerSlider).toBeNull();
  ref.current?.next();
  viewport.resize(801);
  expect(container.querySelectorAll('.slick-slide.slick-active')).toHaveLength(3);
  fireEvent.mouseEnter(container.querySelectorAll('.slick-dots li')[1]);
  act(() => { jest.advanceTimersByTime(20); });
  expect(container.querySelector('.slick-current')?.getAttribute('data-index')).toBe('1');
});

test('selects the smallest inclusive breakpoint from either direction and rebinds changed queries', () => {
  const viewport = mockViewport(768);
  const ref = createRef<Carousel>();
  const { container, rerender, unmount } = render(
    <Carousel ref={ref} slidesToShow={3} responsive={[
      { breakpoint: 768, settings: { slidesToShow: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1 } },
    ]}>{slides}</Carousel>,
  );
  const active = () => container.querySelectorAll('.slick-slide.slick-active').length;
  const instance = ref.current?.innerSlider;
  expect(active()).toBe(2);
  for (const [width, count] of [[768.5, 3], [768, 2], [480, 1], [480.5, 2], [768, 2], [769, 3]]) {
    viewport.resize(width);
    expect(active()).toBe(count);
  }
  viewport.resize(480);
  rerender(<Carousel ref={ref} slidesToShow={3} responsive={[{ breakpoint: 600, settings: { slidesToShow: 2 } }]}>{slides}</Carousel>);
  expect(active()).toBe(2);
  expect(viewport.listeners()).toBe(1);
  expect(ref.current?.innerSlider).toBe(instance);
  rerender(<Carousel ref={ref} slidesToShow={3}>{slides}</Carousel>);
  expect(active()).toBe(3);
  expect(viewport.listeners()).toBe(0);
  rerender(<Carousel ref={ref} responsive={[{ breakpoint: 480, settings: 'unslick' }]}>{slides}</Carousel>);
  expect(ref.current?.innerSlider).toBeNull();
  unmount();
  expect(viewport.listeners()).toBe(0);
});

test('clearing responsive to null restores base settings and removes listeners', () => {
  const viewport = mockViewport(360);
  const { container, rerender } = render(
    <Carousel slidesToShow={2} responsive={[{ breakpoint: 480, settings: 'unslick' }]}>{slides}</Carousel>,
  );
  expect(container.querySelector('.slick-slider')).toBeNull();
  expect(viewport.listeners()).toBe(1);
  rerender(<Carousel slidesToShow={2} responsive={null}>{slides}</Carousel>);
  expect(viewport.listeners()).toBe(0);
  expect(container.querySelectorAll('.slick-slide.slick-active')).toHaveLength(2);
});

test('hovers wrapped dots by li index without counting decorations or nested slider dots', () => {
  jest.useFakeTimers();
  mockViewport(360);
  const outerChange = jest.fn();
  const innerChange = jest.fn();
  const { container } = render(
    <Carousel beforeChange={outerChange} speed={0} dotsActionType={['hover']} responsive={[{
      breakpoint: 480,
      settings: { dotsClass: 'narrow-dots', appendDots: dots => (
        <div>
          <Carousel beforeChange={innerChange} speed={0} dotsActionType={['hover']}>{slides}</Carousel>
          <section><ul data-testid="outer-dots"><span aria-hidden="true" />{dots}</ul></section>
        </div>
      ) },
    }]}>{slides}</Carousel>,
  );
  expect(container.querySelector('.narrow-dots.slick-dots')).not.toBeNull();
  fireEvent.mouseEnter(container.querySelectorAll('.slick-dots .slick-slider .slick-dots li')[2]);
  act(() => { jest.advanceTimersByTime(20); });
  expect(innerChange).toHaveBeenCalledWith(0, 2);
  expect(outerChange).not.toHaveBeenCalled();
  fireEvent.mouseEnter(container.querySelectorAll('[data-testid="outer-dots"] li')[1]);
  act(() => { jest.advanceTimersByTime(20); });
  expect(outerChange).toHaveBeenCalledWith(0, 1);
  expect(innerChange).toHaveBeenCalledTimes(1);
});

test('keeps autoplay paused across a resize until play is requested', () => {
  jest.useFakeTimers();
  const ref = createRef<Carousel>();
  const beforeChange = jest.fn();
  render(<Carousel ref={ref} autoplay autoplaySpeed={100} speed={0} beforeChange={beforeChange}>{slides}</Carousel>);
  act(() => ref.current?.pause());
  fireEvent(window, new Event('resize'));
  act(() => { jest.advanceTimersByTime(600); });
  act(() => { jest.advanceTimersByTime(200); });
  expect(beforeChange).not.toHaveBeenCalled();
  act(() => ref.current?.play());
  act(() => { jest.advanceTimersByTime(150); });
  expect(beforeChange).toHaveBeenCalledWith(0, 1);
});
