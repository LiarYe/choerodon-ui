import { createRef } from 'react';
import { render } from '@testing-library/react';
import Typography from '../../../../components-pro/typography/Typography';
import Base from '../../../../components-pro/typography/Base';

// Isolate the native ellipsis measurement from resize and tooltip plumbing.
jest.mock('choerodon-ui/lib/_util/resizeObserver', () => ({ children }: any) => children);
jest.mock('../../../../components-pro/tooltip', () => ({ children }: any) => children);

test('cleans up the previous pair before attaching replacement refs', () => {
  const events: string[] = [];
  const ref = jest.fn(() => {
    events.push('attach');
    return () => { events.push('cleanup'); };
  });
  const legacy = jest.fn(() => {
    events.push('legacy');
    return () => { events.push('legacy cleanup'); };
  });
  const objectRef = createRef<HTMLElement>();
  const { container, rerender, unmount } = render(<Typography component="article" ref={ref} setContentRef={legacy} />);
  rerender(<Typography component="article" ref={ref} setContentRef={legacy}>updated</Typography>);
  rerender(<Typography component="article" ref={objectRef} setContentRef={legacy} />);
  expect(objectRef.current).toBe(container.firstChild);
  unmount();
  expect(objectRef.current).toBeNull();
  expect(events).toEqual(['attach', 'legacy', 'cleanup', 'legacy cleanup', 'legacy', 'legacy cleanup']);
});

test('Base measures the forwarded DOM node without reattaching on update', () => {
  const measure = jest.fn(() => 100);
  const cleanup = jest.fn();
  const ref = jest.fn((node: HTMLDivElement) => {
    Object.defineProperty(node, 'scrollWidth', { get: measure });
    return cleanup;
  });
  const { container, rerender, unmount } = render(<Base component="div" ellipsis ref={ref}>first</Base>);
  expect(ref).toHaveBeenCalledWith(container.firstChild);
  expect(measure).toHaveBeenCalled();
  rerender(<Base component="div" ellipsis ref={ref}>updated</Base>);
  expect(ref).toHaveBeenCalledTimes(1);
  unmount();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
