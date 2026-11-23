import { createRequire } from 'node:module';
import { useContext, useState, version } from 'react';
import { version as domVersion } from 'react-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import getContext from '../../../components-shared/context-manager/index.tsx';

const Count = getContext(Symbol('react19-counter'), 0);

function Counter() {
  const initial = useContext(Count);
  const [count, setCount] = useState(initial);
  return <button type="button" onClick={() => setCount(count + 1)}>{count}</button>;
}

test('uses the isolated React 19 runtime', () => {
  const local = createRequire(__filename);
  expect(version).toBe('19.3.1');
  expect(domVersion).toBe(version);
  for (const id of ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']) {
    expect(require.resolve(id)).toBe(local.resolve(id));
  }
});

test('mounts, increments and unmounts a counter', () => {
  const { unmount } = render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: '0' }));
  expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
  unmount();
  expect(screen.queryByRole('button')).toBeNull();
});
