import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import TextFieldGroup from '../../../../components-pro/text-field/TextFieldGroup';

test('forwards the existing group host and retains outside blur handling', () => {
  const host = createRef<HTMLDivElement>();
  const onBlur = jest.fn();
  const { container, unmount } = render(
    <TextFieldGroup ref={host} prefixCls="field" className="custom" onBlur={onBlur}>
      <input />
    </TextFieldGroup>,
  );
  expect(host.current).toBe(container.firstElementChild);
  expect(host.current?.className).toBe('field-group-wrapper custom');
  fireEvent.mouseDown(container.querySelector('input')!);
  expect(onBlur).not.toHaveBeenCalled();
  fireEvent.mouseDown(document.body);
  expect(onBlur).toHaveBeenCalledTimes(1);
  unmount();
  expect(host.current).toBeNull();
  fireEvent.mouseDown(document.body);
  expect(onBlur).toHaveBeenCalledTimes(1);
});
