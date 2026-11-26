import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import ColumnResizeHandler from 'choerodon-ui/pro/lib/performance-table/ColumnResizeHandler';

it('does not register a handle for a right-fixed column', () => {
  const { container, unmount } = render(<ColumnResizeHandler columnFixed="right" />);
  expect(container.firstChild).toBeNull();
  unmount();
});

it('tracks touch movement on the owner document only while mounted', () => {
  const start = jest.fn();
  const move = jest.fn();
  const end = jest.fn();
  const { getByRole, unmount } = render(
    <ColumnResizeHandler defaultColumnWidth={160} columnLeft={10} columnFixed="left"
      onColumnResizeStart={start} onColumnResizeMove={move} onColumnResizeEnd={end} />,
  );
  const handle = getByRole('button');
  const touch = x => ({ touches: [{ clientX: x, clientY: 12 }] });
  expect(fireEvent.touchStart(handle, touch(30))).toBe(false);
  expect(start).toHaveBeenCalledWith({ clientX: 30, clientY: 12 });
  fireEvent.touchMove(document, touch(70));
  expect(move).toHaveBeenCalledWith(200, 10, 'left');
  fireEvent.touchEnd(document);
  expect(end).toHaveBeenCalledWith(200, 40);
  fireEvent.touchStart(handle, touch(20));
  unmount();
  fireEvent.touchStart(handle, touch(10));
  fireEvent.touchMove(document, touch(50));
  fireEvent.touchEnd(document);
  expect(start).toHaveBeenCalledTimes(2);
  expect(move).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
});
