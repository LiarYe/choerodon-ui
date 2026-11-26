import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Result from 'choerodon-ui/lib/result/index.tsx';
import defaults from 'choerodon-ui/lib/configure/default';

test.each([
  ['omitted status', {}, 'info', 'info'],
  ['undefined status', { status: undefined }, 'info', 'info'],
  ['explicit status', { status: 'success' }, 'success', 'check_circle'],
])('uses matching class and icon for %s', (_, props, status, icon) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<Result {...props} />);
  const prefix = `${defaults.prefixCls}-result`;
  expect(container.firstElementChild.classList.contains(`${prefix}-${status}`)).toBe(true);
  expect(container.querySelector(`.${prefix}-icon i`).classList.contains(`${defaults.iconfontPrefix}-${icon}`)).toBe(true);
});

test('an explicit icon replaces the built-in icon', () => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<Result icon={<span>Custom</span>} />);
  const icon = container.querySelector(`.${defaults.prefixCls}-result-icon`);
  expect(icon.textContent).toBe('Custom');
  expect(icon.querySelector('i')).toBeNull();
});
