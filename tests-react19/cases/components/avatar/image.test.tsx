import { fireEvent, render, screen } from '@testing-library/react';
import Avatar from '../../../../components/avatar/index.tsx';

import defaults from '../../../../components/configure/default';

test('uses the default prefixes for avatar shapes and the person icon', () => {
  const { container, rerender } = render(<Avatar icon="person" />);
  const avatarPrefix = `${defaults.prefixCls}-avatar`;
  expect(container.firstElementChild?.classList.contains(`${avatarPrefix}-circle`)).toBe(true);
  expect(container.querySelector('i')?.classList.contains(`${defaults.iconfontPrefix}-person`)).toBe(true);
  expect(container.innerHTML).not.toContain('undefined');

  rerender(<Avatar shape="square" icon="person" />);
  expect(container.firstElementChild?.classList.contains(`${avatarPrefix}-square`)).toBe(true);
  expect(container.innerHTML).not.toContain('undefined');
});

test('renders the image and keeps it when onError returns false', () => {
  const onError = jest.fn(() => false);
  render(<Avatar src="/profile.png" alt="Profile" onError={onError} />);

  const image = screen.getByRole('img', { name: 'Profile' });
  expect(image.getAttribute('src')).toBe('/profile.png');
  fireEvent.error(image);
  expect(onError).toHaveBeenCalled();
  expect(screen.getByRole('img', { name: 'Profile' })).toBe(image);
});
