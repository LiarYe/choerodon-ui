import { createRef } from 'react';
import { render } from '@testing-library/react';
import TriggerChild from '../../../../components/trigger/TriggerChild';

test('keeps host registration stable and updates both refs on replacement and unmount', () => {
  const register = jest.fn<void, [() => Element | Text | null, boolean]>();
  const cleanup = jest.fn();
  const original = jest.fn(() => cleanup);
  const replacement = createRef<HTMLButtonElement>();
  const child = (ref: typeof original | typeof replacement, key = 'first') => (
    <TriggerChild register={register}><button key={key} ref={ref} type="button" /></TriggerChild>
  );
  const { getByRole, rerender, unmount } = render(child(original));
  const button = getByRole('button');
  const [[read]] = register.mock.calls;
  expect(register).toHaveBeenCalledWith(read, true);
  expect(read()).toBe(button);
  expect(original).toHaveBeenCalledWith(button);

  rerender(child(original));
  expect(register).toHaveBeenCalledTimes(1);
  expect(cleanup).not.toHaveBeenCalled();

  rerender(child(replacement));
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(original).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenNthCalledWith(2, read, false);
  expect(register).toHaveBeenNthCalledWith(3, read, true);
  expect(read()).toBe(button);
  expect(replacement.current).toBe(button);

  rerender(child(replacement, 'second'));
  const nextButton = getByRole('button');
  expect(nextButton).not.toBe(button);
  expect(read()).toBe(nextButton);
  expect(replacement.current).toBe(nextButton);

  unmount();
  expect(register).toHaveBeenLastCalledWith(read, false);
  expect(read()).toBeNull();
  expect(replacement.current).toBeNull();
});
